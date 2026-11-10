"""SignalRGB bridge: receive the whole-lamp color over loopback UDP and forward it over BLE.

Packet (9 bytes, sent by ``signalrgb/LotusLamp/LotusLamp.js``)::

    b"LOTUS" | version (1) | red | green | blue

Only the newest color matters: frames arriving faster than ``rate`` are
coalesced, repeated colors are never re-sent, and at most one BLE write is in
flight because every write goes through ``LampControl.lock``.
"""

import asyncio
import logging
import time
from contextlib import suppress

MAGIC = b"LOTUS"
VERSION = 1
DEFAULT_PORT = 8421
MAX_RATE = 15  # BLE writes per second
RECEIVING_WINDOW = 2.0  # seconds without packets before "not receiving"
RECONNECT_DELAYS = (2, 4, 8, 16, 30)
LOGGER = logging.getLogger(__name__)


def parse_packet(data):
    """Return ``(r, g, b)`` for a valid packet, otherwise ``None``."""
    if len(data) != len(MAGIC) + 4 or not data.startswith(MAGIC) or data[len(MAGIC)] != VERSION:
        return None
    return tuple(data[len(MAGIC) + 1:])


def encode_packet(r, g, b):
    return MAGIC + bytes([VERSION, r, g, b])


class _Protocol(asyncio.DatagramProtocol):
    def __init__(self, bridge):
        self.bridge = bridge

    def datagram_received(self, data, addr):
        # The socket is bound to loopback; this guards against misconfiguration.
        if addr[0] in ("127.0.0.1", "::1"):
            self.bridge.receive(data)


class SignalRGBBridge:
    def __init__(self, control, port=DEFAULT_PORT, rate=MAX_RATE, clock=time.monotonic):
        self.control = control
        self.port = port
        self.interval = 1 / rate
        self.rate = rate
        self.clock = clock
        self.enabled = False
        self.latest = None
        self.sent = None
        self.last_packet_at = None
        self.received = 0
        self.forwarded = 0
        self.reconnecting = False
        self.error = None
        self.transport = None
        self.task = None
        self._wakeup = asyncio.Event()
        self._stopped = asyncio.Event()

    @property
    def listening(self):
        return self.transport is not None

    @property
    def receiving(self):
        return self.last_packet_at is not None and self.clock() - self.last_packet_at < RECEIVING_WINDOW

    async def start(self):
        try:
            self.transport, _ = await asyncio.get_running_loop().create_datagram_endpoint(
                lambda: _Protocol(self), local_addr=("127.0.0.1", self.port))
        except OSError as exc:
            self.error = f"SignalRGB port {self.port} is unavailable: {exc}. Close the other program using it and restart the app."
            LOGGER.warning(self.error)
            return
        self.port = self.transport.get_extra_info("sockname")[1]
        self.error = None

    async def stop(self):
        self.disable()
        task = self.task
        if task and not task.done():
            with suppress(asyncio.CancelledError, asyncio.TimeoutError):
                await asyncio.wait_for(task, timeout=10)
        if self.transport:
            self.transport.close()
            self.transport = None

    def receive(self, data):
        color = parse_packet(data)
        if color is None:
            return
        self.received += 1
        self.last_packet_at = self.clock()
        self.latest = color
        if self.enabled:
            self._wakeup.set()

    def status(self):
        return {
            "enabled": self.enabled, "listening": self.listening, "port": self.port,
            "rate": self.rate, "receiving": self.receiving,
            "color": "#%02x%02x%02x" % self.latest if self.latest else None,
            "received": self.received, "forwarded": self.forwarded,
            "reconnecting": self.reconnecting, "error": self.error,
        }

    def enable(self):
        if not self.listening:
            raise RuntimeError(self.error or "SignalRGB receiver is not running.")
        self.enabled = True
        self.sent = None  # The lamp may show something else; resend the current color.
        self._stopped.clear()
        self._wakeup.set()
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self.run())

    def disable(self):
        """Stop forwarding. Never cancels an in-flight BLE write: the loop exits on its own."""
        self.enabled = False
        self._stopped.set()
        self._wakeup.set()

    async def _pause(self, seconds):
        """Sleep, but wake immediately when the bridge is disabled."""
        with suppress(asyncio.TimeoutError):
            await asyncio.wait_for(self._stopped.wait(), timeout=seconds)

    async def run(self):
        next_write = 0.0
        attempt = 0
        try:
            while self.enabled:
                self._wakeup.clear()
                if self.latest is None or self.latest == self.sent:
                    await self._wakeup.wait()
                    continue
                wait = next_write - self.clock()
                if wait > 0:
                    await asyncio.sleep(wait)
                    continue
                if not self.control.connected:
                    if await self._reconnect(attempt):
                        attempt = 0
                    else:
                        attempt += 1
                    continue
                color = self.latest
                async with self.control.lock:
                    if not self.enabled:
                        break
                    if not self.control.connected:
                        continue
                    try:
                        await self.control.write("set_rgb", *color, delay=0)
                    except Exception:
                        # control.write already dropped the link; the next pass reconnects.
                        LOGGER.warning("SignalRGB color write failed; reconnecting", exc_info=True)
                        self.sent = None
                        continue
                    self.control.values["color"] = "#%02x%02x%02x" % color
                    self.control.values.pop("mode", None)
                self.sent = color
                self.forwarded += 1
                next_write = self.clock() + self.interval
        finally:
            self.reconnecting = False

    async def _reconnect(self, attempt):
        saved = self.control.saved
        if not saved:
            self.disable()
            return False
        self.reconnecting = True
        try:
            await self.control.connect({"address": saved.address, "name": saved.name})
        except Exception as exc:
            delay = RECONNECT_DELAYS[min(attempt, len(RECONNECT_DELAYS) - 1)]
            LOGGER.warning("SignalRGB reconnect failed (%s); retrying in %ss", exc, delay)
            await self._pause(delay)
            return False
        self.reconnecting = False
        self.sent = None
        return True
