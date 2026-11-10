"""Loopback-only lamp app. Run with ``python -m lotus_lamp.app`` (Python 3.11+)."""

import argparse
import asyncio
import json
import logging
import time
from contextlib import suppress
from uuid import uuid4
from pathlib import Path
import re
import webbrowser
from urllib.request import urlopen
from urllib.error import URLError

from aiohttp import web
from bleak import BleakClient, BleakScanner

from .config import DeviceConfig
from .controller import LotusLamp
from .modes import get_all_mode_names, get_mode_category
from .presets import MAX_PAUSE_MS, PresetStore
from .signalrgb import DEFAULT_PORT as SIGNALRGB_PORT, SignalRGBBridge

WEB_ROOT = Path(__file__).parent / "web"
DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / ".local" / "app-device.json"
CONTROL = web.AppKey("control", object)
PORT = web.AppKey("port", int)
LOGGER = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def integer(value, minimum, maximum, label):
    if type(value) is not int or not minimum <= value <= maximum:
        raise AppError(f"{label} must be an integer from {minimum} to {maximum}.")
    return value


class LampControl:
    """One event loop and one lock own all BLE operations and the active lamp."""

    def __init__(self, config_path=DEFAULT_CONFIG, signalrgb_port=SIGNALRGB_PORT):
        self.config_path = Path(config_path)
        self.saved = None
        self.lamp = None
        self.devices = {}
        self.lock = asyncio.Lock()
        self.values = {}
        self.notice = None
        self.presets = PresetStore(self.config_path.with_suffix(".presets.json"))
        self.playback_task = None
        self.capture = None
        self.signalrgb = SignalRGBBridge(self, signalrgb_port)
        try:
            if self.config_path.exists():
                self.saved = DeviceConfig.from_dict(json.loads(self.config_path.read_text()))
        except (OSError, ValueError, TypeError) as exc:
            self.notice = f"Could not load saved device: {exc}. Scan to select it again."

    @property
    def connected(self):
        return bool(self.lamp and self.lamp.client and self.lamp.client.is_connected)

    def status(self):
        capture = None
        if self.connected and self.capture:
            capture = {key: value for key, value in self.capture.items() if not key.startswith("_")}
            if capture["stage"] == "running":
                capture["elapsed_ms"] = round((time.monotonic() - self.capture["_started_at"]) * 1000)
        return {
            "app": "lotus-lamp-studio",
            "connected": self.connected,
            "device": self.lamp.config.to_dict() if self.connected else None,
            "saved": self.saved.to_dict() if self.saved else None,
            "values": self.values if self.connected else {},
            "notice": self.notice,
            "capture": capture,
            "capabilities": {"spatial_flow": False, "segments": False},
            "signalrgb": self.signalrgb.status(),
        }

    async def scan(self):
        self.signalrgb.disable()
        async with self.lock:
            await self.cancel_playback()
            found = await asyncio.wait_for(
                BleakScanner.discover(timeout=7, return_adv=True), timeout=12
            )
            self.devices = {device.address: device for device, _ in found.values()}
            service = LotusLamp.DEFAULT_SERVICE_UUID.lower()
            result = []
            for device, advert in found.values():
                name = advert.local_name or device.name or "Unnamed device"
                # This is only a visual hint; GATT is validated before any writes.
                likely = service in [uuid.lower() for uuid in advert.service_uuids]
                likely = likely or any(word in name.lower() for word in ("lotus", "melk", "elk-"))
                result.append({"name": name, "address": device.address,
                               "rssi": advert.rssi, "likely": likely})
            return sorted(result, key=lambda device: (not device["likely"], -device["rssi"]))

    async def disconnect(self):
        await self.cancel_playback()
        self.capture = None
        if self.lamp:
            try:
                if self.connected:
                    await asyncio.wait_for(self.lamp.disconnect(), timeout=8)
            finally:
                self.lamp = None
                self.values = {}

    async def cancel_playback(self, preserve_capture=False):
        task = self.playback_task
        if task and task is not asyncio.current_task() and not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        if not preserve_capture and self.capture and self.capture["stage"] in ("starting", "running", "paused"):
            self.capture["stage"] = "cancelled"

    async def write(self, method, *args, **kwargs):
        try:
            await asyncio.wait_for(getattr(self.lamp, method)(*args, **kwargs), timeout=8)
        except Exception:
            # Unknown outcome: release the link and never automatically replay.
            try:
                await self.disconnect()
            except Exception:
                LOGGER.exception("Failed to disconnect after write error")
            raise

    async def start_capture(self, mode, pause_ms=None, speed=100):
        integer(mode, 0, 212, "Program")
        integer(speed, 0, 100, "Capture speed")
        if pause_ms is not None:
            integer(pause_ms, 0, MAX_PAUSE_MS, "Pause time (ms)")
        self.signalrgb.disable()
        async with self.lock:
            # Acquire ownership before cancelling: never interrupt an in-flight
            # BLE write and leave its successful state update unrecorded.
            await self.cancel_playback()
            if not self.connected:
                raise AppError("Connect to your lamp first.", 409)
            self.notice = None
            self.capture = {"id": uuid4().hex, "mode": mode, "stage": "starting", "elapsed_ms": 0,
                            "pause_ms": pause_ms, "speed": speed}
            self.playback_task = asyncio.create_task(self.timed_playback(mode, pause_ms, speed))
        return self.status()

    async def timed_playback(self, mode, pause_ms, speed):
        try:
            async with self.lock:
                # Same normalization recipe used in physical comparisons. BLE
                # off/on is not an electrical reset or a guaranteed loop zero.
                await self.write("power_off")
                self.values["power"] = False
                await self.write("power_on")
                self.values["power"] = True
                await self.write("set_rgb", 0, 0, 0)
                self.values.update(color="#000000")
                self.values.pop("mode", None)
                await self.write("set_speed", speed)
                self.values.update(speed=speed, hold=False)
                await self.write("set_animation", mode, delay=0)
                started = self.lamp.last_write_started
                self.values["mode"] = mode
                self.values.pop("color", None)
                self.capture.update(stage="running", _started_at=started)
            # Capture sessions automatically stop at the supported 10 minute limit.
            target = MAX_PAUSE_MS if pause_ms is None else pause_ms
            await asyncio.sleep(max(0, started + target / 1000 - time.monotonic()))
            async with self.lock:
                await self.write("hold_animation", delay=0)
                self.values["hold"] = True
                actual = round((self.lamp.last_write_started - started) * 1000)
                self.capture.update(stage="paused", elapsed_ms=target, actual_pause_ms=actual)
        except asyncio.CancelledError:
            raise
        except Exception:
            self.notice = "Timed playback failed. Reconnect before trying again; it was not replayed."
            LOGGER.exception("Timed playback failed")

    def set_signalrgb(self, data):
        enabled = data.get("enabled")
        if type(enabled) is not bool:
            raise AppError("SignalRGB sync must be true or false.")
        if not enabled:
            self.signalrgb.disable()
            return self.status()
        if not self.connected:
            raise AppError("Connect to your lamp first.", 409)
        try:
            self.signalrgb.enable()
        except RuntimeError as exc:
            raise AppError(str(exc), 503) from exc
        return self.status()

    def preset_list(self):
        return {"presets": self.presets.items, "notice": self.presets.error}

    def save_preset(self, data):
        try:
            self.presets.save(data)
        except (ValueError, OSError) as exc:
            raise AppError(str(exc)) from exc
        return self.preset_list()

    def delete_preset(self, data):
        try:
            self.presets.delete(data.get("id"))
        except (ValueError, OSError) as exc:
            raise AppError(str(exc)) from exc
        return self.preset_list()

    async def connect(self, data):
        address = data.get("address")
        if not isinstance(address, str) or not address or len(address) > 128:
            raise AppError("Select a device from the scan or reconnect your saved lamp.")
        if address not in self.devices and not (self.saved and self.saved.address == address):
            raise AppError("Scan again so this device can be selected.")
        name = data.get("name", "My lamp")
        if not isinstance(name, str) or not name.strip() or len(name) > 100:
            raise AppError("Use a lamp name between 1 and 100 characters.")
        async with self.lock:
            await self.disconnect()
            config = self.saved if self.saved and self.saved.address == address else DeviceConfig(name=name, address=address)
            lamp = LotusLamp(device_config=config)
            # Never use the library's name-based fallback: address identifies the lamp.
            client = BleakClient(self.devices.get(address, address), timeout=15)
            try:
                await asyncio.wait_for(client.connect(), timeout=20)
                if not client.is_connected:
                    raise AppError("The lamp did not complete its Bluetooth connection.", 502)
                service = client.services.get_service(config.service_uuid)
                characteristic = service.get_characteristic(config.write_char_uuid) if service else None
                if not characteristic or "write-without-response" not in characteristic.properties:
                    raise AppError("This device does not expose the supported Lotus Lamp control service. No commands were sent.", 422)
                lamp.client = client
                lamp._connected = True
                self.lamp = lamp
                self.values = {}
                self.saved = config
                self.notice = None
                try:
                    self.config_path.parent.mkdir(parents=True, exist_ok=True)
                    temporary = self.config_path.with_suffix(".tmp")
                    temporary.write_text(json.dumps(config.to_dict(), indent=2))
                    temporary.chmod(0o600)
                    temporary.replace(self.config_path)
                except OSError:
                    self.notice = "Connected, but could not save this device. Select it again next time."
            except BaseException:
                if client.is_connected:
                    try:
                        await asyncio.wait_for(client.disconnect(), timeout=5)
                    except Exception:
                        LOGGER.exception("Failed to close incomplete connection")
                raise
            return self.status()

    async def command(self, data):
        action = data.get("action")
        value = data.get("value")
        # Validate before touching hardware or acquiring the command queue.
        if action == "power":
            if type(value) is not bool:
                raise AppError("Power must be true or false.")
            method, args = ("power_on" if value else "power_off"), ()
        elif action == "hold":
            if type(value) is not bool:
                raise AppError("Hold must be true or false.")
            if value:
                method, args = "hold_animation", ()
            else:
                resume_speed = integer(data.get("resume_speed"), 0, 100, "Resume speed")
                method, args = "set_speed", (resume_speed,)
        elif action == "color":
            if not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
                raise AppError("Choose a valid six-digit RGB color.")
            method, args = "set_rgb", tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))
        elif action in ("brightness", "speed", "mode"):
            integer(value, 0, 212 if action == "mode" else 100, action.title())
            method, args = {"brightness": "set_brightness", "speed": "set_speed", "mode": "set_animation"}[action], (value,)
        else:
            raise AppError("Unknown lamp command.")
        capturing = action == "hold" and value is True
        # A manual control always wins over SignalRGB streaming.
        self.signalrgb.disable()
        async with self.lock:
            await self.cancel_playback(preserve_capture=capturing)
            if not self.connected:
                raise AppError("Connect to your lamp first.", 409)
            await self.write(method, *args)
            if capturing and self.capture and self.capture["stage"] == "running":
                elapsed = round((self.lamp.last_write_started - self.capture["_started_at"]) * 1000)
                self.capture.update(stage="paused", elapsed_ms=elapsed)
            elif capturing and self.capture and self.capture["stage"] == "starting":
                self.capture["stage"] = "cancelled"
            self.values[action] = value
            if action == "speed":
                self.values["hold"] = False
            elif action == "hold" and not value:
                self.values["speed"] = resume_speed
            if action == "color":
                self.values.pop("mode", None)
            elif action == "mode":
                self.values.pop("color", None)
            return self.status()


@web.middleware
async def local_only(request, handler):
    # Block DNS rebinding and browser requests originating on unrelated websites.
    if request.host not in {f"127.0.0.1:{request.app[PORT]}", f"localhost:{request.app[PORT]}"}:
        return web.json_response({"error": "Use the local app URL."}, status=403)
    origin = request.headers.get("Origin")
    if origin and origin != f"http://{request.host}":
        return web.json_response({"error": "Only the local app can control the lamp."}, status=403)
    if request.method == "POST" and (
        request.headers.get("X-Lotus-Local") != "1" or request.content_type != "application/json"
    ):
        return web.json_response({"error": "Use the local app controls."}, status=403)
    try:
        response = await handler(request)
    except AppError as exc:
        response = web.json_response({"error": str(exc)}, status=exc.status)
    except (json.JSONDecodeError, UnicodeDecodeError):
        response = web.json_response({"error": "Invalid JSON request."}, status=400)
    except Exception as exc:
        if isinstance(exc, web.HTTPException):
            raise
        LOGGER.exception("Lamp operation failed")
        message = "Bluetooth operation timed out. Move closer and reconnect." if isinstance(exc, asyncio.TimeoutError) else (
            f"Bluetooth operation failed: {exc}. Check Bluetooth permission, keep the lamp nearby, and close its phone app."
        )
        response = web.json_response({"error": message}, status=502)
    response.headers.update({
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
    })
    return response


async def index(request):
    return web.FileResponse(WEB_ROOT / "index.html")


async def asset(request):
    name = request.match_info["name"]
    if name not in {"app.js", "i18n.js", "style.css", "favicon.svg"}:
        raise web.HTTPNotFound()
    return web.FileResponse(WEB_ROOT / name)


async def status(request):
    return web.json_response(request.app[CONTROL].status())


async def modes(request):
    return web.json_response([{"id": key, "name": name, "category": get_mode_category(key)}
                              for key, name in sorted(get_all_mode_names().items())])


async def presets(request):
    return web.json_response(request.app[CONTROL].preset_list())


async def action(request):
    control = request.app[CONTROL]
    data = await request.json()
    if not isinstance(data, dict):
        raise AppError("Request must be a JSON object.")
    operation = request.match_info["operation"]
    if operation == "scan":
        return web.json_response({"devices": await control.scan()})
    if operation == "connect":
        return web.json_response(await control.connect(data))
    if operation == "disconnect":
        control.signalrgb.disable()
        async with control.lock:
            await control.disconnect()
        return web.json_response(control.status())
    if operation == "command":
        return web.json_response(await control.command(data))
    if operation == "capture":
        return web.json_response(await control.start_capture(data.get("mode"), speed=data.get("speed", 100)))
    if operation == "signalrgb":
        async with control.lock:
            return web.json_response(control.set_signalrgb(data))
    if operation == "preset-save":
        return web.json_response(control.save_preset(data))
    if operation == "preset-delete":
        return web.json_response(control.delete_preset(data))
    if operation == "preset-play":
        preset = control.presets.get(data.get("id"))
        if not preset:
            raise AppError("This preset no longer exists. Refresh and try again.", 404)
        return web.json_response(await control.start_capture(preset["mode"], preset["pause_ms"], preset["speed"]))
    if operation == "flow":
        raise AppError("Custom spatial flow needs a verified pixel/palette command. This controller currently exposes only fixed effects. No commands were sent.", 422)
    if operation == "segments":
        raise AppError("Segment commands are not documented for this controller. The segment design is a preview only; no commands were sent.", 422)
    raise web.HTTPNotFound()


def create_app(port=8420, config_path=DEFAULT_CONFIG, control=None):
    app = web.Application(middlewares=[local_only], client_max_size=4096)
    app[PORT] = port
    app[CONTROL] = control if control is not None else LampControl(config_path)
    app.router.add_get("/", index)
    app.router.add_get("/assets/{name}", asset)
    app.router.add_get("/api/status", status)
    app.router.add_get("/api/modes", modes)
    app.router.add_get("/api/presets", presets)
    app.router.add_post("/api/{operation}", action)

    async def startup(application):
        await application[CONTROL].signalrgb.start()

    async def cleanup(application):
        await application[CONTROL].signalrgb.stop()
        await application[CONTROL].disconnect()

    app.on_startup.append(startup)
    app.on_cleanup.append(cleanup)
    return app


def main():
    parser = argparse.ArgumentParser(description="Local Lotus Lamp control app")
    parser.add_argument("--port", type=int, default=8420)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--signalrgb-port", type=int, default=SIGNALRGB_PORT,
                        help="Loopback UDP port for the SignalRGB plugin (default %(default)s)")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535 or not 1024 <= args.signalrgb_port <= 65535:
        parser.error("Choose ports from 1024 to 65535.")
    url = f"http://127.0.0.1:{args.port}"
    try:
        with urlopen(url + "/api/status", timeout=1) as response:
            existing = json.load(response)
        if isinstance(existing, dict) and existing.get("app") == "lotus-lamp-studio":
            print(f"Lotus Lamp is already running at {url}")
            if not args.no_browser:
                webbrowser.open(url)
            return
    except (URLError, OSError, ValueError):
        pass
    app = create_app(args.port, control=LampControl(args.config, args.signalrgb_port))
    if not args.no_browser:
        async def open_browser(application):
            asyncio.get_running_loop().call_later(0.5, webbrowser.open, url)
        app.on_startup.append(open_browser)
    print(f"Lotus Lamp · {url}\nKeep this window open. Press Ctrl+C to stop.", flush=True)
    web.run_app(app, host="127.0.0.1", port=args.port, print=None)


if __name__ == "__main__":
    main()
