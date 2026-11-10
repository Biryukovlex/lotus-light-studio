"""Local app contracts. No real Bluetooth access or lamp writes in this suite."""

import asyncio
import json
import os
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
import pytest_asyncio
from aiohttp.test_utils import TestClient, TestServer

from lotus_lamp import DeviceConfig, LotusLamp
from lotus_lamp.app import AppError, LampControl, create_app


@pytest.fixture
def control(tmp_path):
    return LampControl(tmp_path / "device.json", signalrgb_port=0)


@pytest.fixture
def client_mock():
    client = Mock()
    client.is_connected = False
    characteristic = SimpleNamespace(properties=["write-without-response"])
    service = Mock()
    service.get_characteristic.return_value = characteristic
    client.services.get_service.return_value = service

    async def connect():
        client.is_connected = True

    async def disconnect():
        client.is_connected = False

    client.connect = AsyncMock(side_effect=connect)
    client.disconnect = AsyncMock(side_effect=disconnect)
    client.write_gatt_char = AsyncMock()
    return client


@pytest.fixture
def connected(control, client_mock):
    control.lamp = LotusLamp(device_config=DeviceConfig(name="Test lamp", address="exact-device"))
    control.lamp.client = client_mock
    control.lamp._connected = True
    client_mock.is_connected = True
    return control


@pytest_asyncio.fixture
async def http(control):
    async with TestClient(TestServer(create_app(control=control))) as client:
        yield client


HEADERS = {"Host": "127.0.0.1:8420", "X-Lotus-Local": "1", "Origin": "http://127.0.0.1:8420"}


@pytest.mark.asyncio
async def test_connect_pins_identity_and_saves_only_after_validation(control, client_mock):
    device = SimpleNamespace(address="exact-device", name="Test lamp")
    control.devices[device.address] = device
    with patch("lotus_lamp.app.BleakClient", return_value=client_mock) as factory:
        status = await control.connect({"address": device.address, "name": device.name})
    factory.assert_called_once_with(device, timeout=15)
    assert status["connected"] is True
    assert json.loads(control.config_path.read_text())["address"] == device.address
    if os.name != "nt":  # POSIX permission bits do not apply on Windows
        assert control.config_path.stat().st_mode & 0o777 == 0o600
    client_mock.write_gatt_char.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconnect_uses_saved_address_without_name_fallback(control, client_mock):
    control.saved = DeviceConfig(name="Duplicate name", address="saved-device")
    with patch("lotus_lamp.app.BleakClient", return_value=client_mock) as factory:
        await control.connect({"address": "saved-device", "name": "Duplicate name"})
    factory.assert_called_once_with("saved-device", timeout=15)
    assert control.saved.address == "saved-device"


@pytest.mark.asyncio
async def test_wrong_service_rejected_and_disconnected(control, client_mock):
    control.devices["device"] = "device"
    client_mock.services.get_service.return_value = None
    with patch("lotus_lamp.app.BleakClient", return_value=client_mock):
        with pytest.raises(AppError, match="does not expose"):
            await control.connect({"address": "device", "name": "Not a lamp"})
    client_mock.disconnect.assert_awaited_once()
    client_mock.write_gatt_char.assert_not_awaited()
    assert not control.config_path.exists()
    assert not control.connected


@pytest.mark.asyncio
async def test_connect_failure_does_not_fall_back_to_other_lamp(control, client_mock):
    control.saved = DeviceConfig(name="Same name", address="saved-device")
    client_mock.connect.side_effect = ConnectionError("Unavailable")
    with patch("lotus_lamp.app.BleakClient", return_value=client_mock) as factory:
        with pytest.raises(ConnectionError):
            await control.connect({"address": "saved-device", "name": "Same name"})
    assert factory.call_count == 1
    assert control.saved.address == "saved-device"
    assert not control.connected


@pytest.mark.asyncio
async def test_cannot_connect_arbitrary_unscanned_address(control):
    with pytest.raises(AppError, match="Scan again"):
        await control.connect({"address": "unobserved", "name": "Test"})


@pytest.mark.asyncio
async def test_actual_rgb_frame_and_state(connected, client_mock):
    status = await connected.command({"action": "color", "value": "#112233"})
    client_mock.write_gatt_char.assert_awaited_once_with(
        LotusLamp.DEFAULT_WRITE_CHAR_UUID, bytes.fromhex("7e 07 05 03 11 22 33 10 ef"), response=False
    )
    assert status["values"]["color"] == "#112233"


@pytest.mark.asyncio
async def test_auto_play_mode_zero_is_not_clamped_to_one(connected, client_mock):
    await connected.command({"action": "mode", "value": 0})
    assert client_mock.write_gatt_char.await_args.args[1] == bytes.fromhex("7e 07 03 00 ff ff ff 00 ef")


@pytest.mark.asyncio
async def test_hold_bypasses_normal_speed_clamp_and_resume_accepts_zero(connected, client_mock):
    held = await connected.command({"action": "hold", "value": True})
    assert held["values"]["hold"] is True
    resumed = await connected.command({"action": "hold", "value": False, "resume_speed": 0})
    assert [call.args[1] for call in client_mock.write_gatt_char.await_args_list] == [
        bytes.fromhex("7e 04 02 80 ff ff ff 00 ef"),
        bytes.fromhex("7e 04 02 00 ff ff ff 00 ef"),
    ]
    assert resumed["values"] == {"hold": False, "speed": 0}


@pytest.mark.asyncio
async def test_normal_speed_clears_hold_request(connected, client_mock):
    await connected.command({"action": "hold", "value": True})
    status = await connected.command({"action": "speed", "value": 25})
    assert status["values"] == {"hold": False, "speed": 25}


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"action": "hold", "value": 1},
    {"action": "hold", "value": False},
    {"action": "hold", "value": False, "resume_speed": 128},
    {"action": "hold", "value": False, "resume_speed": True},
    {"action": "speed", "value": 128},
])
async def test_hold_validation_never_writes(connected, client_mock, payload):
    with pytest.raises(AppError):
        await connected.command(payload)
    client_mock.write_gatt_char.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("action,value", [("brightness", -1), ("speed", 101), ("mode", 213),
    ("mode", True), ("power", 1), ("color", "red"), ("color", "#123"), ("unknown", 50)])
async def test_invalid_command_never_writes(connected, client_mock, action, value):
    with pytest.raises(AppError):
        await connected.command({"action": action, "value": value})
    client_mock.write_gatt_char.assert_not_awaited()


@pytest.mark.asyncio
async def test_disconnected_command_refused(control):
    with pytest.raises(AppError, match="Connect") as error:
        await control.command({"action": "power", "value": True})
    assert error.value.status == 409


@pytest.mark.asyncio
async def test_write_failure_clears_connection_and_is_never_replayed(connected, client_mock):
    client_mock.write_gatt_char.side_effect = ConnectionError("Link lost")
    with pytest.raises(ConnectionError):
        await connected.command({"action": "color", "value": "#112233"})
    assert client_mock.write_gatt_char.await_count == 1
    assert not connected.connected
    assert connected.status()["values"] == {}


@pytest.mark.asyncio
async def test_concurrent_commands_are_serialized(connected, client_mock):
    active = 0
    maximum = 0

    async def write(*args, **kwargs):
        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        await asyncio.sleep(0.01)
        active -= 1

    client_mock.write_gatt_char.side_effect = write
    await asyncio.gather(*(connected.command({"action": "brightness", "value": value}) for value in (10, 20, 30)))
    assert maximum == 1
    assert [call.args[1][3] for call in client_mock.write_gatt_char.await_args_list] == [10, 20, 30]


def test_unexpected_disconnect_hides_stale_values(connected, client_mock):
    connected.values = {"power": True}
    client_mock.is_connected = False
    assert connected.status()["connected"] is False
    assert connected.status()["values"] == {}


def test_corrupt_config_does_not_prevent_startup(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text("not json")
    control = LampControl(path)
    assert control.saved is None
    assert "Could not load" in control.notice


@pytest.mark.asyncio
async def test_http_assets_and_mode_catalog(http):
    for path in ("/", "/assets/app.js", "/assets/style.css", "/assets/favicon.svg"):
        response = await http.get(path, headers=HEADERS)
        assert response.status == 200
        assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    response = await http.get("/api/modes", headers=HEADERS)
    modes = await response.json()
    assert [mode["id"] for mode in modes] == list(range(213))


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [
    {**HEADERS, "Host": "evil.example:8420"},
    {**HEADERS, "Origin": "https://evil.example"},
    {"Host": "127.0.0.1:8420"},
])
async def test_rebinding_cross_origin_and_unmarked_posts_rejected(http, headers):
    response = await http.post("/api/scan", json={}, headers=headers)
    assert response.status == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["flow", "segments"])
async def test_requested_custom_regimes_rejected_without_ble_writes(http, operation):
    with patch("lotus_lamp.app.BleakClient") as client:
        response = await http.post(f"/api/{operation}", json={"colors": ["#ff0000", "#00ff00"]}, headers=HEADERS)
    assert response.status == 422
    assert "No commands were sent" in (await response.json())["error"] or operation == "segments"
    client.assert_not_called()


@pytest.mark.asyncio
async def test_json_array_is_not_accepted_as_command(http):
    response = await http.post("/api/command", json=[], headers=HEADERS)
    assert response.status == 400


@pytest.mark.asyncio
async def test_capabilities_do_not_claim_unsupported_hardware_features(http):
    response = await http.get("/api/status", headers=HEADERS)
    status = await response.json()
    assert status["app"] == "lotus-lamp-studio"
    assert status["capabilities"] == {"spatial_flow": False, "segments": False}


@pytest.mark.asyncio
async def test_scan_preserves_real_devices_and_prioritizes_lamps(control):
    lamp = SimpleNamespace(name="MELK-OA10 65", address="lamp")
    other = SimpleNamespace(name="Speaker", address="speaker")
    advert = lambda name, rssi: SimpleNamespace(local_name=name, service_uuids=[], rssi=rssi)
    found = {"lamp": (lamp, advert(lamp.name, -70)), "speaker": (other, advert(other.name, -30))}
    with patch("lotus_lamp.app.BleakScanner.discover", new=AsyncMock(return_value=found)):
        devices = await control.scan()
    assert devices[0]["address"] == "lamp"
    assert control.devices["lamp"] is lamp


async def wait_for_stage(control, stage):
    async def wait():
        while not control.capture or control.capture["stage"] != stage:
            await asyncio.sleep(.005)
    await asyncio.wait_for(wait(), timeout=3)


@pytest.mark.asyncio
async def test_timed_replay_frames_and_clock_origin(connected, client_mock):
    writes = []
    async def write(uuid, frame, **kwargs):
        writes.append((frame, time.monotonic()))
    client_mock.write_gatt_char.side_effect = write
    status = await connected.start_capture(138, 80)
    assert status["capture"]["stage"] == "starting"
    await asyncio.wait_for(connected.playback_task, timeout=3)
    assert [frame.hex(' ') for frame, _ in writes] == [
        "7e 07 04 00 00 ff ff 00 ef", "7e 07 04 01 00 ff ff 00 ef",
        "7e 07 05 03 00 00 00 10 ef", "7e 04 02 64 ff ff ff 00 ef",
        "7e 07 03 8a ff ff ff 00 ef", "7e 04 02 80 ff ff ff 00 ef",
    ]
    # Deadline starts at mode write, not after the default 100 ms cooldown.
    assert .07 <= writes[-1][1] - writes[-2][1] < .5
    assert connected.status()["capture"]["elapsed_ms"] == 80
    assert abs(connected.status()["capture"]["actual_pause_ms"] - (writes[-1][1] - writes[-2][1]) * 1000) < 2
    assert connected.values == {"power": True, "speed": 100, "hold": True, "mode": 138}


@pytest.mark.asyncio
async def test_pause_captures_server_time_and_cancels_future_hold(connected, client_mock):
    await connected.start_capture(138, 60000)
    await wait_for_stage(connected, "running")
    started = connected.capture["_started_at"]
    status = await connected.command({"action": "hold", "value": True})
    assert status["capture"]["stage"] == "paused"
    assert status["capture"]["elapsed_ms"] == round((connected.lamp.last_write_started - started) * 1000)
    assert connected.playback_task.cancelled()
    assert client_mock.write_gatt_char.await_args.args[1][3] == 128
    assert "_started_at" not in status["capture"]


@pytest.mark.asyncio
async def test_manual_speed_cancels_pending_replay_without_late_pause(connected, client_mock):
    await connected.start_capture(138, 60000)
    await wait_for_stage(connected, "running")
    status = await connected.command({"action": "speed", "value": 12})
    assert status["capture"]["stage"] == "cancelled"
    assert connected.playback_task.cancelled()
    assert client_mock.write_gatt_char.await_args.args[1][3] == 12
    assert status["values"]["hold"] is False
    assert not any(call.args[1][2:4] == b'\x02\x80' for call in client_mock.write_gatt_char.await_args_list)


@pytest.mark.asyncio
async def test_disconnect_cancels_replay_and_does_not_resume_on_reconnect(connected, client_mock):
    await connected.start_capture(138, 60000)
    await wait_for_stage(connected, "running")
    await connected.disconnect()
    assert connected.playback_task.cancelled()
    assert connected.status()["capture"] is None
    assert not connected.connected


@pytest.mark.asyncio
async def test_timed_write_failure_disconnects_and_never_retries(connected, client_mock):
    client_mock.write_gatt_char.side_effect = ConnectionError("Link lost")
    await connected.start_capture(138, 258)
    await asyncio.wait_for(connected.playback_task, timeout=3)
    assert client_mock.write_gatt_char.await_count == 1
    assert not connected.connected
    assert "not replayed" in connected.notice


@pytest.mark.asyncio
async def test_concurrent_starts_leave_only_one_worker(connected, client_mock):
    await asyncio.gather(connected.start_capture(138, 60000), connected.start_capture(89, 60000))
    await wait_for_stage(connected, "running")
    assert connected.capture["mode"] == 89
    modes = [call.args[1][3] for call in client_mock.write_gatt_char.await_args_list if call.args[1][2] == 3]
    assert modes == [89]
    await connected.disconnect()


@pytest.mark.asyncio
async def test_pause_during_startup_cancels_capture_without_claiming_saved_time(connected):
    await connected.start_capture(138)
    result = await connected.command({"action": "hold", "value": True})
    assert result["values"]["hold"] is True
    assert result["capture"]["stage"] == "cancelled"


@pytest.mark.asyncio
async def test_scan_cancels_pending_pause_before_holding_ble_lock(connected):
    await connected.start_capture(138, 60000)
    await wait_for_stage(connected, "running")
    with patch("lotus_lamp.app.BleakScanner.discover", new=AsyncMock(return_value={})):
        await connected.scan()
    assert connected.playback_task.cancelled()
    assert connected.capture["stage"] == "cancelled"


@pytest.mark.asyncio
async def test_preset_http_crud_offline_and_missing_play(http, control):
    response = await http.post('/api/preset-save', headers=HEADERS,
        json={"name": "Night", "mode": 138, "pause_ms": 258})
    assert response.status == 200
    item = (await response.json())["presets"][0]
    response = await http.get('/api/presets', headers=HEADERS)
    assert (await response.json())["presets"] == [item]
    response = await http.post('/api/preset-play', headers=HEADERS, json={"id": item["id"]})
    assert response.status == 409
    response = await http.post('/api/preset-save', headers=HEADERS, json={**item, "pause_ms": 300})
    assert (await response.json())["presets"][0]["pause_ms"] == 300
    response = await http.post('/api/preset-delete', headers=HEADERS, json={"id": item["id"]})
    assert (await response.json())["presets"] == []
    response = await http.post('/api/preset-play', headers=HEADERS, json={"id": item["id"]})
    assert response.status == 404
    assert control.values == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("speed", [0, 17])
async def test_capture_and_replay_use_saved_speed(connected, client_mock, speed):
    connected.save_preset({"name": "Slow", "mode": 138, "pause_ms": 30, "speed": speed})
    item = connected.presets.items[0]
    await connected.start_capture(item["mode"], item["pause_ms"], item["speed"])
    await asyncio.wait_for(connected.playback_task, timeout=3)
    frames = [call.args[1] for call in client_mock.write_gatt_char.await_args_list]
    assert frames[3] == bytes([0x7e, 4, 2, speed, 255, 255, 255, 0, 0xef])
    assert connected.status()["capture"]["speed"] == speed
    assert connected.values["speed"] == speed
    assert connected.values["hold"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("speed", [True, -1, 101, 12.5])
async def test_invalid_capture_speed_never_writes(connected, client_mock, speed):
    with pytest.raises(AppError, match="Capture speed"):
        await connected.start_capture(138, speed=speed)
    client_mock.write_gatt_char.assert_not_awaited()


@pytest.mark.asyncio
async def test_http_forwards_capture_and_saved_replay_speeds(http, connected, client_mock):
    response = await http.post('/api/capture', headers=HEADERS, json={"mode": 138, "speed": 17})
    assert response.status == 200
    assert (await response.json())["capture"]["speed"] == 17
    await connected.command({"action": "hold", "value": True})
    response = await http.post('/api/preset-save', headers=HEADERS,
        json={"name": "Slow", "mode": 138, "speed": 9, "pause_ms": 0})
    item = (await response.json())["presets"][0]
    response = await http.post('/api/preset-play', headers=HEADERS, json={"id": item["id"]})
    assert (await response.json())["capture"]["speed"] == 9
    await asyncio.wait_for(connected.playback_task, timeout=3)
    assert connected.values["speed"] == 9
    assert connected.values["hold"] is True
