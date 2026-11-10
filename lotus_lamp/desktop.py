"""Native Windows app: the local server in a window, with a system-tray icon.

Closing the window hides it to the tray so SignalRGB sync keeps running;
"Exit" in the tray menu stops the server and releases Bluetooth.
Build with ``scripts/build-windows.ps1``.
"""

import argparse
import asyncio
import ctypes
import json
import logging
import os
import sys
import threading
from logging.handlers import RotatingFileHandler
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

APP_NAME = "Lotus Light Studio"
DEFAULT_PORT = 8420
LOGGER = logging.getLogger(__name__)


def data_dir():
    return Path(os.environ.get("LOCALAPPDATA") or Path.home()) / APP_NAME


def spanish_ui():
    try:
        return ctypes.windll.kernel32.GetUserDefaultUILanguage() & 0x3FF == 0x0A
    except (AttributeError, OSError):
        return False


def tray_labels():
    if spanish_ui():
        return {"open": f"Abrir {APP_NAME}", "exit": "Salir (libera el Bluetooth)"}
    return {"open": f"Open {APP_NAME}", "exit": "Exit (releases Bluetooth)"}


def make_icon(size=64):
    """The favicon (dark tile, lilac lamp, glow) drawn with Pillow; no SVG renderer needed."""
    from PIL import Image, ImageDraw

    scale = size / 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=16 * scale, fill="#090611")
    draw.rounded_rectangle((28 * scale, 10 * scale, 36 * scale, 50 * scale), radius=4 * scale, fill="#c49aff")
    draw.ellipse((16 * scale, 50 * scale, 48 * scale, 56 * scale), fill="#794b9d")
    return image


def local_request(port, path, body=None, timeout=1.0):
    headers = {"Host": f"127.0.0.1:{port}"}
    data = None
    if body is not None:
        headers.update({"Content-Type": "application/json", "X-Lotus-Local": "1"})
        data = json.dumps(body).encode()
    with urlopen(Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers), timeout=timeout) as response:
        return json.load(response)


def already_running(port):
    """If another instance owns the port, ask it to show its window."""
    try:
        status = local_request(port, "/api/status")
    except (URLError, OSError, ValueError):
        return False
    if not isinstance(status, dict) or status.get("app") != "lotus-lamp-studio":
        return False
    try:
        local_request(port, "/api/show-window", {})
    except (URLError, OSError, ValueError):
        LOGGER.info("Running instance has no window (web launcher); leaving it alone")
    return True


class ServerThread:
    """aiohttp on its own event loop, so the GUI can own the main thread."""

    def __init__(self, port, signalrgb_port, config_path, on_show):
        self.port = port
        self.signalrgb_port = signalrgb_port
        self.config_path = config_path
        self.on_show = on_show
        self.loop = asyncio.new_event_loop()
        self.ready = threading.Event()
        self.error = None
        self.runner = None
        self.thread = threading.Thread(target=self._run, name="lotus-server", daemon=True)

    def start(self, timeout=15):
        self.thread.start()
        if not self.ready.wait(timeout):
            raise RuntimeError("The local server did not start in time.")
        if self.error:
            raise self.error

    def _run(self):
        from aiohttp import web
        from .app import LampControl, create_app

        asyncio.set_event_loop(self.loop)
        try:
            app = create_app(self.port, control=LampControl(self.config_path, self.signalrgb_port), on_show=self.on_show)
            self.runner = web.AppRunner(app)
            self.loop.run_until_complete(self.runner.setup())
            self.loop.run_until_complete(web.TCPSite(self.runner, "127.0.0.1", self.port).start())
        except BaseException as exc:  # Reported to the GUI thread.
            self.error = exc
            self.ready.set()
            return
        self.ready.set()
        self.loop.run_forever()

    def stop(self):
        """Run the app cleanup (stops SignalRGB, disconnects BLE), then end the loop."""
        if self.runner and self.loop.is_running():
            future = asyncio.run_coroutine_threadsafe(self.runner.cleanup(), self.loop)
            try:
                future.result(timeout=15)
            except Exception:
                LOGGER.exception("Server cleanup failed")
            self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--minimized", action="store_true", help="Start hidden in the system tray")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--signalrgb-port", type=int, default=8421)
    parser.add_argument("--data-dir", type=Path, default=data_dir())
    args = parser.parse_args()

    args.data_dir.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(args.data_dir / "lotus-light-studio.log", maxBytes=1_000_000, backupCount=2,
                                  encoding="utf-8")
    logging.basicConfig(handlers=[handler], level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # The UI polls /api/status twice a second; access lines would flood the log.
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)

    if already_running(args.port):
        return

    import pystray
    import webview

    state = {"window": None, "quitting": False}

    def show():
        window = state["window"]
        if window:
            window.show()
            window.restore()

    server = ServerThread(args.port, args.signalrgb_port, args.data_dir / "app-device.json", show)
    try:
        server.start()
    except Exception as exc:
        LOGGER.exception("Could not start the local server")
        ctypes.windll.user32.MessageBoxW(None, f"{APP_NAME} could not start:\n{exc}", APP_NAME, 0x10)
        sys.exit(1)

    window = webview.create_window(APP_NAME, f"http://127.0.0.1:{args.port}", width=1280, height=860,
                                   min_size=(420, 600), background_color="#090611", hidden=args.minimized)
    state["window"] = window

    def on_closing():
        if state["quitting"]:
            return True
        window.hide()  # Keep running in the tray so SignalRGB sync continues.
        return False

    window.events.closing += on_closing

    def quit_app(icon, _item=None):
        state["quitting"] = True
        icon.stop()
        server.stop()
        window.destroy()

    labels = tray_labels()
    icon = pystray.Icon("lotus-light-studio", make_icon(64), APP_NAME, menu=pystray.Menu(
        pystray.MenuItem(labels["open"], lambda _icon, _item: show(), default=True),
        pystray.MenuItem(labels["exit"], quit_app),
    ))
    icon.run_detached()

    # A persistent profile keeps the language choice (localStorage) between launches.
    webview.start(private_mode=False, storage_path=str(args.data_dir / "webview"))
    if not state["quitting"]:  # Window closed by the system (logoff/shutdown).
        icon.stop()
        server.stop()


if __name__ == "__main__":
    main()
