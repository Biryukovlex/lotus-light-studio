"""SignalRGB bridge contracts: loopback UDP in, throttled and de-duplicated BLE writes out."""

import asyncio
import socket
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from aiohttp.test_utils import TestClient, TestServer

from lotus_lamp import DeviceConfig, LotusLamp
from lotus_lamp.app import AppError, LampControl, create_app
from lotus_lamp.signalrgb import RECONNECT_DELAYS, encode_packet, parse_packet

HEADERS = {"Host": "127.0.0.1:8420", "X-Lotus-Local": "1", "Origin": "http://127.0.0.1:8420"}


def ble_frame(r, g, b):
    return bytes([0x7E, 0x07, 0x05, 0x03, r, g, b, 0x10, 0xEF])


def make_client():
    client = Mock()
    client.is_connected = True
    client.write_gatt_char = AsyncMock()
    client.disconnect = AsyncMock()
    return client


def attach_lamp(control, client):
    control.lamp = LotusLamp(device_config=DeviceConfig(name="Test lamp", address="exact-device"))
    control.lamp.client = client
    control.lamp._connected = True
    control.saved = control.lamp.config


def colors_written(client):
    return [call.args[1] for call in client.write_gatt_char.await_args_list]


@pytest_asyncio.fixture
async def bridge_control(tmp_path):
    control = LampControl(tmp_path / "device.json", signalrgb_port=0)
    client = make_client()
    attach_lamp(control, client)
    await control.signalrgb.start()
    sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    def send(*rgb, raw=None):
        sender.sendto(raw if raw is not None else encode_packet(*rgb), ("127.0.0.1", control.signalrgb.port))

    yield SimpleNamespace(control=control, client=client, send=send)
    sender.close()
    await control.signalrgb.stop()


async def until(predicate, timeout=2.0):
    deadline = asyncio.get_running_loop().time() + timeout
    while not predicate():
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("condition not reached")
        await asyncio.sleep(0.01)


def test_packet_format_round_trip_and_rejects_foreign_data():
    assert encode_packet(1, 2, 3) == b"LOTUS\x01\x01\x02\x03"
    assert parse_packet(encode_packet(255, 0, 128)) == (255, 0, 128)
    for bad in (b"", b"LOTUS\x01\x01\x02", b"LOTUS\x01\x01\x02\x03\x04", b"LOTUZ\x01\x01\x02\x03", b"LOTUS\x02\x01\x02\x03"):
        assert parse_packet(bad) is None


@pytest.mark.asyncio
async def test_receiver_listens_only_on_loopback(bridge_control):
    host, port = bridge_control.control.signalrgb.transport.get_extra_info("sockname")[:2]
    assert host == "127.0.0.1" and port == bridge_control.control.signalrgb.port


@pytest.mark.asyncio
async def test_packets_ignored_while_disabled(bridge_control):
    bridge_control.send(10, 20, 30)
    await until(lambda: bridge_control.control.signalrgb.received == 1)
    await asyncio.sleep(0.1)
    bridge_control.client.write_gatt_char.assert_not_awaited()
    assert bridge_control.control.status()["signalrgb"]["receiving"] is True


@pytest.mark.asyncio
async def test_color_forwarded_once_and_repeats_dropped(bridge_control):
    control, client = bridge_control.control, bridge_control.client
    control.set_signalrgb({"enabled": True})
    for _ in range(5):
        bridge_control.send(200, 100, 50)
    await until(lambda: control.signalrgb.received == 5)
    await asyncio.sleep(0.2)
    assert colors_written(client) == [ble_frame(200, 100, 50)]
    assert control.values["color"] == "#c86432"
    assert control.signalrgb.forwarded == 1


@pytest.mark.asyncio
async def test_bursts_are_coalesced_to_rate_limit_and_end_on_latest(bridge_control):
    control, client = bridge_control.control, bridge_control.client
    control.set_signalrgb({"enabled": True})
    for value in range(60):  # A 60 fps burst, much faster than the 15/s limit.
        bridge_control.send(value, 0, 0)
    await until(lambda: control.signalrgb.received == 60)
    await until(lambda: control.signalrgb.sent == (59, 0, 0))
    writes = colors_written(client)
    assert len(writes) <= 3
    assert writes[-1] == ble_frame(59, 0, 0)


@pytest.mark.asyncio
async def test_sustained_stream_never_exceeds_rate(bridge_control):
    control, client = bridge_control.control, bridge_control.client
    control.set_signalrgb({"enabled": True})
    loop = asyncio.get_running_loop()
    started = loop.time()
    value = 0
    while loop.time() - started < 1.0:
        value = (value + 1) % 256
        bridge_control.send(0, value, 0)
        await asyncio.sleep(1 / 60)
    assert len(client.write_gatt_char.await_args_list) <= 16


@pytest.mark.asyncio
async def test_manual_command_disables_sync_and_stops_forwarding(bridge_control):
    control, client = bridge_control.control, bridge_control.client
    control.set_signalrgb({"enabled": True})
    bridge_control.send(1, 1, 1)
    await until(lambda: control.signalrgb.forwarded == 1)
    await control.command({"action": "color", "value": "#ffffff"})
    assert control.status()["signalrgb"]["enabled"] is False
    bridge_control.send(9, 9, 9)
    await until(lambda: control.signalrgb.received == 2)
    await asyncio.sleep(0.15)
    assert colors_written(client) == [ble_frame(1, 1, 1), ble_frame(255, 255, 255)]


@pytest.mark.asyncio
async def test_enable_requires_connection_and_listening_receiver(tmp_path):
    control = LampControl(tmp_path / "device.json", signalrgb_port=0)
    with pytest.raises(AppError) as error:
        control.set_signalrgb({"enabled": True})
    assert error.value.status == 409
    attach_lamp(control, make_client())
    with pytest.raises(AppError) as error:  # Receiver never started.
        control.set_signalrgb({"enabled": True})
    assert error.value.status == 503
    with pytest.raises(AppError):
        control.set_signalrgb({"enabled": "yes"})


@pytest.mark.asyncio
async def test_busy_port_is_reported_not_fatal(tmp_path):
    holder = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    holder.bind(("127.0.0.1", 0))
    control = LampControl(tmp_path / "device.json", signalrgb_port=holder.getsockname()[1])
    try:
        await control.signalrgb.start()
        status = control.status()["signalrgb"]
        assert status["listening"] is False and "unavailable" in status["error"]
    finally:
        holder.close()


@pytest.mark.asyncio
async def test_write_failure_reconnects_saved_lamp_and_resends_latest(bridge_control):
    control, client = bridge_control.control, bridge_control.client
    client.write_gatt_char.side_effect = OSError("link lost")
    replacement = make_client()

    async def reconnect(data):
        assert data["address"] == "exact-device"
        attach_lamp(control, replacement)

    control.connect = AsyncMock(side_effect=reconnect)
    control.set_signalrgb({"enabled": True})
    bridge_control.send(5, 6, 7)
    await until(lambda: control.signalrgb.forwarded == 1)
    control.connect.assert_awaited_once()
    assert colors_written(replacement) == [ble_frame(5, 6, 7)]
    assert control.signalrgb.enabled is True


@pytest.mark.asyncio
async def test_failed_reconnect_backs_off_and_disable_interrupts_wait(bridge_control):
    control = bridge_control.control
    control.connect = AsyncMock(side_effect=OSError("out of range"))
    control.set_signalrgb({"enabled": True})
    bridge_control.client.is_connected = False  # Link drops after sync starts.
    bridge_control.send(1, 2, 3)
    await until(lambda: control.connect.await_count == 1)
    await asyncio.sleep(0.2)
    assert control.connect.await_count == 1  # Waiting RECONNECT_DELAYS[0] seconds, not hammering.
    assert RECONNECT_DELAYS[0] >= 2
    assert control.status()["signalrgb"]["reconnecting"] is True
    control.set_signalrgb({"enabled": False})
    await asyncio.wait_for(control.signalrgb.task, timeout=1)
    assert control.status()["signalrgb"]["reconnecting"] is False


@pytest.mark.asyncio
async def test_http_toggle_status_and_disconnect_turns_sync_off(tmp_path):
    control = LampControl(tmp_path / "device.json", signalrgb_port=0)
    attach_lamp(control, make_client())
    async with TestClient(TestServer(create_app(control=control))) as http:
        status = await (await http.get("/api/status", headers=HEADERS)).json()
        assert status["signalrgb"]["listening"] is True and status["signalrgb"]["enabled"] is False
        response = await http.post("/api/signalrgb", json={"enabled": True}, headers=HEADERS)
        assert response.status == 200 and (await response.json())["signalrgb"]["enabled"] is True
        response = await http.post("/api/disconnect", json={}, headers=HEADERS)
        assert (await response.json())["signalrgb"]["enabled"] is False
        response = await http.post("/api/signalrgb", json={"enabled": True}, headers=HEADERS)
        assert response.status == 409
