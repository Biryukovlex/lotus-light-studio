"""SignalRGB bridge: receive the whole-lamp color over loopback UDP and forward it over BLE.

Packets (version 1, sent by ``signalrgb/LotusLamp/LotusLamp.js``)::

    color        9 bytes   b"LOTUS" | 1 | red | green | blue
    power off    7 bytes   b"LOTUS" | 1 | 0x00               (SignalRGB exit, PC shutdown or sleep)
    final color 10 bytes   b"LOTUS" | 1 | 0x01 | r | g | b   (the plugin's Shutdown Color)

Power off and final color are "shutdown instructions": they skip the rate limit
and de-duplication. After power off, the next color turns the lamp back on.

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
SHUTDOWN_GRACE = 2.0  # seconds the desktop app waits for the plugin's final instruction
CMD_POWER_OFF = 0x00
CMD_FINAL_COLOR = 0x01
LOGGER = logging.getLogger(__name__)


def parse_packet(data):
    """Return ``("color", rgb)``, ``("off", None)`` or ``("final", rgb)``; ``None`` if invalid."""
    head = len(MAGIC) + 1
    if len(data) < head + 1 or not data.startswith(MAGIC) or data[len(MAGIC)] != VERSION:
        return None
    body = data[head:]
    if len(body) == 3:
        return "color", tuple(body)
    if len(body) == 1 and body[0] == CMD_POWER_OFF:
        return "off", None
    if len(body) == 4 and body[0] == CMD_FINAL_COLOR:
        return "final", tuple(body[1:])
    return None


def encode_packet(r, g, b):
    return MAGIC + bytes([VERSION, r, g, b])


def encode_power_off():
    return MAGIC + bytes([VERSION, CMD_POWER_OFF])


def encode_final_color(r, g, b):
    return MAGIC + bytes([VERSION, CMD_FINAL_COLOR, r, g, b])


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
        self.pending = None  # Shutdown instruction: ("off", None) or ("final", rgb)
        self.lamp_off = False  # True after a power-off instruction; the next color powers on
        self.shutdown_handled_at = None
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
        packet = parse_packet(data)
        if packet is None:
            return
        kind, color = packet
        self.received += 1
        self.last_packet_at = self.clock()
        if kind == "color":
            self.latest = color
        elif self.enabled:  # Ignored while sync is off, so it can never fire later.
            self.pending = packet
            self.latest = self.sent = None  # Nothing newer to stream after a shutdown instruction.
        if self.enabled:
            self._wakeup.set()

    @property
    def shutdown_handled(self):
        """A shutdown instruction was applied recently (a sleep hours ago does not count)."""
        return self.shutdown_handled_at is not None and self.clock() - self.shutdown_handled_at < 10

    def status(self):
        return {
            "enabled": self.enabled, "listening": self.listening, "port": self.port,
            "rate": self.rate, "receiving": self.receiving,
            "color": "#%02x%02x%02x" % self.latest if self.latest else None,
            "received": self.received, "forwarded": self.forwarded,
            "reconnecting": self.reconnecting, "error": self.error,
        }

    async def session_ending(self, grace=SHUTDOWN_GRACE):
        """Windows is shutting down: give the plugin a moment, then make sure the lamp is off.

        Only acts while sync is on. If the plugin already sent its final instruction
        (power off or Shutdown Color), that choice is respected.
        """
        if not self.enabled:
            return
        loop = asyncio.get_running_loop()
        deadline = loop.time() + grace
        while not self.shutdown_handled and loop.time() < deadline:
            await asyncio.sleep(0.05)
        if self.shutdown_handled or not self.control.connected:
            return
        LOGGER.info("No shutdown instruction from SignalRGB; turning the lamp off")
        self.disable()
        async with self.control.lock:
            if self.control.connected and not self.lamp_off:
                await self.control.write("power_off")
                self.control.values["power"] = False
                self.lamp_off = True

    def enable(self):
        if not self.listening:
            raise RuntimeError(self.error or "SignalRGB receiver is not running.")
        self.enabled = True
        self.sent = None  # The lamp may show something else; resend the current color.
        self.pending = None
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
                if self.pending:
                    if not await self._apply_pending():
                        attempt += 1
                    continue
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
                        if self.lamp_off:
                            await self.control.write("power_on")
                            self.control.values["power"] = True
                            self.lamp_off = False
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

    async def _apply_pending(self):
        """Send a shutdown instruction right away (no rate limit, no de-duplication)."""
        if not self.control.connected:
            return await self._reconnect(0)
        kind, color = self.pending
        async with self.control.lock:
            if not self.enabled or not self.control.connected:
                return False
            try:
                if kind == "off":
                    await self.control.write("power_off")
                    self.control.values["power"] = False
                    self.lamp_off = True
                else:
                    await self.control.write("set_rgb", *color, delay=0)
                    self.control.values["color"] = "#%02x%02x%02x" % color
                    self.control.values.pop("mode", None)
            except Exception:
                LOGGER.warning("SignalRGB shutdown instruction failed", exc_info=True)
                return False
        self.pending = None
        self.forwarded += 1
        self.shutdown_handled_at = self.clock()
        return True

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
