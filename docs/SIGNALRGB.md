# SignalRGB sync

Lotus Light Studio can let [SignalRGB](https://signalrgb.com) effects color the lamp alongside the
rest of a PC's RGB devices. SignalRGB has no Bluetooth LE output, so a small SignalRGB network
plugin hands the color to the local app, which writes it to the lamp over BLE.

```
SignalRGB effect ──► LotusLamp.js plugin ──UDP 127.0.0.1:8421──► lotus_lamp/signalrgb.py ──BLE──► lamp
   (canvas)          (1-LED network device)   9-byte packet        (≤15 writes/s, no repeats)
```

Tested on Windows 11 with SignalRGB 2.5.86 (free tier) and a **MELK-OA10** controller.

## Set up

1. **Install the plugin.** Copy the `signalrgb/LotusLamp` folder to
   `Documents\WhirlwindFX\Plugins\LotusLamp` (or `OneDrive\Documents\…` when Documents is synced),
   then restart SignalRGB. User plugins are only read at startup.
2. **Check it appears.** SignalRGB → Devices lists **Lotus Lamp** with the app logo. No IP address
   is needed: the app only listens on this PC, so the plugin announces a single local device.
3. **Start the app** (the Windows app, `Launch Lotus Lamp.bat`, or `python -m lotus_lamp.app`),
   connect the lamp and switch **SignalRGB sync** on.
4. **Place the lamp.** In SignalRGB → Layouts, move Lotus Lamp to the part of the canvas whose color
   it should follow, for example on top of a RAM stick or LED strip.

The panel shows a live swatch and counters (`received · sent to lamp · max 15/s`) so you can see
that colors are arriving.

## What to expect

- **One color for the whole lamp.** The controller only accepts a whole-lamp RGB color. SignalRGB
  sees a 1×1 device and samples the canvas at its position, so an effect that moves along a strip
  appears on the lamp as one color changing over time.
- **Up to 15 updates per second.** Slow and medium effects (color cycle, breathing, gradients,
  full-color audio visualizers, screen ambience) look smooth; very fast strobes can lose flashes.
- **Some latency.** BLE adds roughly 50–150 ms compared with wired RGB devices.
- **Light load.** Each update is a 9-byte BLE write without response (about 135 bytes/s at the
  limit). At most one write is in flight and frames are never queued, so a busy effect cannot
  build up a backlog. CPU and memory use of the bridge are negligible.

## Behavior rules

| Situation | Behavior |
| --- | --- |
| Sync off | Packets are counted (so the panel can show "receiving") but never written to the lamp |
| Frames faster than 15/s | Merged: only the newest color is written when the next slot opens |
| Same color repeated | Not written again (the plugin also resends an unchanged color only once per second) |
| Any manual control (color, effect, brightness, speed, Pause, capture, preset replay, scan, disconnect) | Sync turns off and the panel explains why; the manual action wins |
| Bluetooth write fails or the link drops while syncing | The saved lamp is reconnected automatically, waiting 2, 4, 8, 16, then 30 s between attempts; the latest color is sent once connected. Outside SignalRGB sync, failed writes are still never retried |
| SignalRGB closes, Windows shuts down or the PC sleeps | The plugin's **Shutdown Action** runs: by default the lamp gets the real power-off command; the next effect color turns it back on (for example after waking from sleep) |
| App restarts (including the Windows Startup shortcut) | If sync was on when it last ran, it turns back on and reconnects the saved lamp when colors arrive. A manual control clears this preference |
| UDP port busy | The app still starts; the panel shows the error and the switch is disabled |

## Shutdown, sleep and power loss

The lamp has its own power supply: it does not switch itself off when data stops, so it is turned
off explicitly. These rules apply while SignalRGB sync is on.

- **SignalRGB closes, Windows shuts down or restarts, or the PC goes to sleep:** SignalRGB calls the
  plugin's `Shutdown()`, which applies **Shutdown Action** (device settings in SignalRGB):
  - **Turn lamp off** (default) sends the lamp's real power-off command. The next effect color
    sends power-on first, so the lamp comes back by itself when SignalRGB starts again or the PC
    wakes up. After a restart of the PC or the app, the lamp's power state is unknown, so the first
    color after sync turns on (or after a reconnect) is always preceded by power-on.
  - **Use Shutdown Color** sends the **Shutdown Color** instead; the lamp stays powered.
- **Safety net in the Windows app (`.exe`):** when Windows ends the session, the app lets the
  shutdown proceed (it never cancels it), waits up to 2 s for the plugin's instruction, and turns
  the lamp off itself if none arrived (for example, SignalRGB was already closed). An instruction
  the plugin sent is respected, including Shutdown Color. The web launcher (`.bat`) has no safety
  net and relies on the plugin.
- **Crash or power cut:** nothing can be sent; the lamp keeps the last color until it is turned off
  another way.

## Plugin

`signalrgb/LotusLamp/LotusLamp.js` is a SignalRGB network plugin (`Type()` returns `"network"`):

- One LED (`Size() = [1, 1]`). `Render()` reads `device.color(0, 0)` and sends it when it changes,
  plus a keepalive once per second.
- Settings: **Lighting Mode** (Canvas follows the effect, Forced uses **Forced Color**),
  **Shutdown Action** (Turn lamp off / Use Shutdown Color) and **Shutdown Color**.
- `DiscoveryService()` announces one controller (`id: lotus-lamp-local`, `127.0.0.1`) through
  `service.addController` / `announceController`. The official docs do not describe network
  discovery; this follows the pattern of SignalRGB's bundled WLED plugin.
- `LotusLamp.qml` is the plugin's card on the Network page, with a field to change the UDP port
  (saved with `service.saveSetting`; restart SignalRGB to apply it).
- The device image is the app logo, embedded as a base64 PNG (`device.setImageFromBase64`).

## Packet format

Every UDP datagram starts with ASCII `LOTUS` and version `1`:

| Packet | Bytes | Meaning |
| --- | --- | --- |
| Color | `LOTUS` `01` R G B (9 bytes) | Stream this color (rate-limited, repeats skipped) |
| Power off | `LOTUS` `01` `00` (7 bytes) | Shutdown instruction: send the power-off command now |
| Final color | `LOTUS` `01` `01` R G B (10 bytes) | Shutdown instruction: send this color now, even if unchanged |

Shutdown instructions skip the rate limit and are ignored while sync is off, so they can never fire
later. Anything else is ignored. The receiver binds to `127.0.0.1` only, so other machines on the network
cannot change the lamp. `encode_packet` / `parse_packet` in `lotus_lamp/signalrgb.py` define the
format. Any program on the same PC can drive the lamp the same way; for example, in Python:

```python
import socket
socket.socket(socket.AF_INET, socket.SOCK_DGRAM).sendto(b"LOTUS\x01\xff\x00\x80", ("127.0.0.1", 8421))
```

The lamp only changes while sync is on.

## Configuration

| Setting | Where |
| --- | --- |
| UDP port (default 8421) | App: `--signalrgb-port 8431` (web app, `lotus_lamp.desktop` and the `.exe` all accept it). Plugin: port field on its Network card. Both must match |
| Remembered sync state | `app-device.settings.json` beside the device file (`{"signalrgb": true}`) |
| Rate limit | Fixed at 15 writes/s (`MAX_RATE` in `lotus_lamp/signalrgb.py`) |

## API

| Request | Body / result |
| --- | --- |
| `POST /api/signalrgb` | `{"enabled": true}` or `{"enabled": false}`. Turning on requires a connected lamp (409) and a running receiver (503) |
| `GET /api/status` → `signalrgb` | `enabled`, `listening`, `port`, `rate`, `receiving` (a packet within 2 s), `color`, `received`, `forwarded`, `reconnecting`, `error` |

POST requests use the same loopback, Origin and `X-Lotus-Local` protections as the rest of the API.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Lotus Lamp is not in SignalRGB → Devices | The folder is `Documents\WhirlwindFX\Plugins\LotusLamp` (or the OneDrive equivalent) and SignalRGB was restarted. The application log (`%LOCALAPPDATA%\WhirlwindFX\SignalRgb\logs`) should contain `Custom Plugin File Loaded … LotusLamp.js` |
| Panel says "Waiting for SignalRGB" | SignalRGB is running with an effect applied, the device is enabled, and the ports match |
| Counters rise but the lamp does not change | Sync is on and the lamp is connected; close the lamp's phone app, which can hold the BLE link |
| Lamp color differs from a nearby device | The lamp samples its own canvas position; move it in Layouts. LED hardware also renders the same RGB value differently |
| Port error in the panel | Another program uses 8421; pick another with `--signalrgb-port` and the plugin card |

## Code and tests

| Path | Role |
| --- | --- |
| `signalrgb/LotusLamp/LotusLamp.js`, `LotusLamp.qml` | SignalRGB plugin and its Network card |
| `lotus_lamp/signalrgb.py` | UDP receiver, rate limit, de-duplication, reconnect loop |
| `lotus_lamp/app.py` | `/api/signalrgb`, status, manual-control takeover, remembered preference |
| `lotus_lamp/web/` | SignalRGB panel and English/Spanish strings |
| `tests/test_signalrgb.py` | Packet format, loopback binding, dedupe, burst coalescing, sustained rate, manual takeover, reconnect/backoff, busy port, remembered state, HTTP, power off/on, final color, session-end safety net |
| `tests/web_app.test.cjs`, `tests/i18n.test.cjs` | Panel rendering, toggle requests, takeover message, translations |

Physical check (9 November 2026, Windows 11, MELK-OA10): SignalRGB listed the plugin device; the
app received the "Be Quiet!" and "Poison" effects and wrote about 10 colors/s to the lamp, from both
the web app and the packaged Windows app. Changing the effect through the SignalRGB MCP server was
not possible on the free tier.
