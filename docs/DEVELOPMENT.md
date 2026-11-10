# Local app development and delivery

## Run

Production runtime: Python 3.11+ on a Bluetooth-capable Mac. No Node runtime,
frontend build service, account, or Internet connection is needed after initial
Python dependencies are installed.

Double-click `Launch Lotus Lamp.command`, or run from the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-app.lock
.venv/bin/python -m lotus_lamp.app --no-browser
```

Open http://127.0.0.1:8420. Keep the process running. Close the lamp's phone app
before connecting. Use Disconnect before controlling it from another app.
Ctrl+C shuts down the server and releases Bluetooth. The launcher reuses an
already-running compatible local instance. There is no background service.

The main delivery is a browser-based local app. An optional locally signed macOS
window can be built with `.venv/bin/python scripts/build_macos_launcher.py`; see the
[Desktop launcher](../LOCAL_APP.md#desktop-launcher). It runs the same server and
frontend, keeping the loopback and Bluetooth boundaries. It is not notarized or a
self-contained Python distribution.

## Architecture

| Path | Responsibility |
| --- | --- |
| `lotus_lamp/app.py` | aiohttp HTTP API, validation, exact device identity, serialized BLE operations |
| `lotus_lamp/controller.py` | BLE command frames, normal speed, experimental animation hold |
| `lotus_lamp/presets.py` | Versioned, validated, atomic local preset storage |
| `lotus_lamp/signalrgb.py` | SignalRGB bridge: loopback UDP receiver, 15/s rate limit, de-duplication, BLE reconnect ([SIGNALRGB.md](SIGNALRGB.md)) |
| `lotus_lamp/desktop.py` | Windows app: server thread, pywebview window, tray icon, single instance |
| `lotus_lamp/web/i18n.js` | English/Spanish strings, language picker, server message translation |
| `signalrgb/LotusLamp/` | SignalRGB network plugin (`LotusLamp.js`) and its Network card (`LotusLamp.qml`) |
| `scripts/build-windows.ps1` | PyInstaller build of the Windows app from `requirements-desktop-windows.lock` |
| `scripts/install-windows-shortcuts.ps1` | Desktop and Startup shortcuts, one-time migration of `.local` files |
| `lotus_lamp/web/index.html` | Semantic controls and the single large Pause/Resume button |
| `lotus_lamp/web/style.css` | Theme tokens, responsive layout, control states |
| `lotus_lamp/web/app.js` | Connection UI, commands, busy/error state, playback toggle |
| `lotus_lamp/modes.py` | Built-in effect IDs and names |
| `scripts/macos_launcher.swift` | Native local window, server lifecycle and app icon |
| `scripts/build_macos_launcher.py` | Build/sign the local wrapper and optionally install it |
| `tests/test_app.py` | API protections and actual outgoing protocol bytes via BLE mocks |
| `tests/test_signalrgb.py` | SignalRGB packets, throttling, takeover, reconnect and remembered sync |
| `tests/web_app.test.cjs` | Frontend pause/resume, failure and concurrency contracts |
| `tests/i18n.test.cjs` | Language detection and Spanish translations, including server messages |
| `docs/APP_DESIGN.md` | Visual direction and interaction requirements |
| `docs/CUSTOM_CONTROL_INVESTIGATION.md` | Physical evidence and controller limitations |

Canonical repository: https://github.com/Biryukovlex/lotus-light-studio.
The existing `lotus_lamp` import/package name is retained for compatibility.

The frontend is intentionally framework-free. The foundation comparison is in
[FOUNDATION_REVIEW.md](FOUNDATION_REVIEW.md); no reviewed application code was imported. Its assets are packaged into the
Python wheel. Editing saved frontend files takes effect on browser reload; a
server restart is unnecessary. Python changes require a server restart.

## API contract

GET `/api/status` returns connection state, saved identity, and `values` submitted
successfully during the current connection. It is not a complete live hardware
snapshot. Reconnecting clears `values`. GET `/api/modes` returns the effect list.

POST requests require JSON and the `X-Lotus-Local: 1` header. Host and Origin
checks restrict requests to this loopback app. Do not weaken them for remote
hosting. The server should remain bound to 127.0.0.1.

| Endpoint / action | Body |
| --- | --- |
| `/api/scan` | `{}` |
| `/api/connect` | Device object from scan or the exact saved device |
| `/api/disconnect` | `{}` |
| `/api/command`, power | `{"action":"power","value":true}` |
| `/api/command`, brightness | `{"action":"brightness","value":75}` |
| `/api/command`, RGB | `{"action":"color","value":"#82cba8"}` |
| `/api/command`, effect | `{"action":"mode","value":138}` |
| `/api/command`, speed | `{"action":"speed","value":0}` |
| `/api/command`, pause | `{"action":"hold","value":true}` |
| `/api/command`, resume | `{"action":"hold","value":false,"resume_speed":0}` |
| `/api/capture` | `{"mode":138,"speed":17}` |
| `/api/preset-save` | `{"name":"Night","mode":138,"pause_ms":258,"speed":17}`; add `id` to update |
| `/api/preset-play` | `{"id":"saved-preset-id"}` |
| `/api/preset-delete` | `{"id":"saved-preset-id"}` |
| `/api/signalrgb` | `{"enabled":true}`; requires a connected lamp. See [SIGNALRGB.md](SIGNALRGB.md#api) |
| `/api/show-window` | `{}`; only in the Windows app, raises its window (used by a second launch) |

Power and hold use strict booleans. Brightness, normal speed and resume speed use
integers 0..100; mode uses 0..212. Applying an effect submits mode then normal
speed. Changing speed resumes playback. Failed commands are not automatically
replayed. A write failure disconnects the lamp; the UI refreshes status and
retains the actionable error instead of showing a successful pause.

GET `/api/presets` returns `{presets, notice}`. Recipes contain an opaque `id`,
name (1–80 characters), program (0–212), speed (integer 0–100), and integer
`pause_ms` (0–600000). Omitted speed defaults to 100 for older clients/files;
reading an old file normalizes it in memory without rewriting the original.
Storage is version 1, up to 100 entries, beside the configured device file with
suffix `.presets.json`. Save/delete only touch local disk, including offline.
Corrupt/unsupported files are preserved and edits rejected. No identity is
embedded in recipes. As with normal controls, a recipe targets the connected lamp.

Capture/play return immediately with status `capture.stage = starting`. A single
server task serializes off/on, solid black, saved speed, then the selected mode.
The clock starts at the host's mode-write submission, before any library cooldown.
The controller's optional `delay=0` on mode/hold avoids a 100 ms minimum offset.
After the monotonic deadline it sends raw 128. State transitions are starting →
running → paused; manual controls can make the state cancelled. Status includes
the program, speed, elapsed milliseconds, target (null for manual capture), and session
ID. On automatic replay `elapsed_ms` holds the recipe target, while
`actual_pause_ms` records the observed host write offset for diagnostics (neither
is a firmware timestamp). Private monotonic timestamps never leave the process. During manual capture,
Pause records its own host write timestamp. A 10 minute limit auto-pauses capture.

The task releases the BLE lock while waiting. Manual controls acquire that lock,
then cancel the timer, so an in-flight BLE write always finishes its state update.
Pause preserves and captures elapsed time. Scan/connect/disconnect/shutdown cancel outstanding work. New sessions cancel
older sessions, including concurrent starts. Bluetooth write errors disconnect
without retry and surface a status notice. Neither recipes nor pending work are
automatically executed after startup/reconnection. The one exception is SignalRGB
sync: while it is on, the bridge reconnects the saved lamp with backoff and sends
only the newest color, and a remembered sync preference resumes at startup.
Any manual control turns sync off first. Closing or reloading a browser
does not affect a server task; stopping/disconnecting the server does.

## Pause implementation and limits

Pause sends `7e 04 02 80 ff ff ff 00 ef`. Resume uses the ordinary speed frame
`7e 04 02 XX ff ff ff 00 ef`, with XX in 0..100. Do not change the normal speed
clamp to expose 128 on the slider. Speed 0 still moves slowly.

SSG-500 preset 138 physically froze at raw 128 for over a minute, and resumed at
0. This is an observed firmware behavior, not a documented universal pause
opcode. Other presets and indefinite hold have not been established. The UI
uses familiar Pause/Resume labels without protocol explanation around the
control. Its state records successful requests, not optical confirmation.

Arbitrary spatial colors, static segment palettes, firmware export and exact
paused-frame recall remain unimplemented. Do not add mock controls for them.
No firmware flashing, reset, or hardware modification is part of this app.

Approximate timed recall is implemented separately. Repeated physical tests at
258 ms still shifted, even with host request times matched within 0.004 ms and
BLE power off/on normalization. This does not establish the cause: BLE delivery
and internal renderer state remain unmeasured. The UI must retain its approximate
label. There is no measured native loop period, guaranteed loop-zero reset,
framebuffer capture, or seek. Never describe elapsed recipe time as cycle phase.

## Verification

Install development dependencies and run:

```sh
uv pip install --python .venv/bin/python -e '.[app,dev]'
.venv/bin/python -m pytest -o addopts='-q --tb=short'
node --check lotus_lamp/web/app.js
node --test tests/web_app.test.cjs tests/i18n.test.cjs
git diff --check
uv build --wheel --out-dir dist
```

Node 20+ is an optional development dependency for the frontend tests, never an
application runtime dependency. No hosted CI workflow is currently committed; these are local commands.
Python and JavaScript unit tests use mocks and
must not be described as proof of physical lamp output.

Acceptance checks:

- Connect a saved lamp and scan/select another without substituting identities.
- Pause is the most visually prominent control. It changes to a play symbol and
  Resume only after successful command submission.
- Resume honors selected speed 0; the UI never maps 0 to pause.
- Busy/disconnected controls cannot send overlapping playback requests.
- Failed writes show an error and never invent a successful paused state.
- Apply effect, normal speed, brightness, RGB and power remain available.
- The dark neon theme, keyboard focus, reduced motion and widths from 320px
  upward remain usable. No horizontal overflow or hidden primary control.
- No external network assets or unsupported custom editors. Animated previews
  are explicitly illustrative and must never transmit BLE commands.

## Distribution and private files

The delivery source ZIP is made from tracked files at a named Git commit. It
includes source, launcher, pinned runtime lockfile, tests, MIT license, and docs.
The accompanying wheel contains the library and frontend assets; install with
its app extra if distributing independently. An installed wheel should be run
with `--config` pointing to a writable user directory; see [Configuration](../CONFIGURATION.md).

Never distribute `.local/`, `.venv/`, browser storage, personal saved-device
configuration, original recovery archives, proprietary APKs/decompilation,
local logs, or Git credentials. Those are not required to build or run this app.
Existing recovery backups remain separate. There is no recoverable firmware
image in this source package.

Native wrapper bundles under `output/launchers/` embed the local checkout path;
keep them private and rebuild from source on another Mac. The wrapper reuses an
already-running compatible server, otherwise starts `.venv/bin/python` directly.
Only a server it started receives SIGTERM on Quit/window close. Generated app
state remains in the existing `.local/` directory. Native builds need macOS 12+
and Xcode Command Line Tools; Python dependencies must already be installed.

## Animated program discovery

All 213 modes from /api/modes remain selectable. The frontend derives illustrative
color palettes from mode names and motion families from category metadata. The
canvas renderer is not a firmware emulator. Gallery tiles select a preview only;
Apply effect is the separate hardware action. Search and category filters update
the same selection. Pagination renders 24 tiles at a time. Reduced-motion and
page visibility are checked before advancing animation; drawing creates no API
requests. The main illustration holds with the requested pause, while other
thumbnail illustrations continue to show candidate effects.

## Preset library and capture dialog

The Effects library is headed Presets with native Default/Custom tab semantics,
roving focus and Left/Right/Home/End keyboard navigation. Default retains the
searchable 213-effect catalog. Custom contains local recipes and their saved
speed. Add custom preset opens a native modal dialog with an independent full
catalog selector, speed slider, illustration, Pause button, clock, name and time.
New captures default to 25%, independently of the current playback/replay speed.
The next new dialog remembers the last capture speed chosen in that browser session.

The dialog owns its capture by the server's session ID. Only that capture can
fill its draft timing; unrelated replay/polls never overwrite it. Effect and
speed are fixed while capturing. After pausing, changing those inputs requires
recapture or an explicitly entered time for a new recipe. Editing an existing
recipe allows deliberate field changes. Save stores speed, closes the popup,
and selects Custom. Replay uses that same speed rather than converting elapsed
time between speeds (the native speed curve is unknown). Brightness is unchanged.

Opening/choosing/cancelling an idle draft never writes to BLE. Closing an active
capture or Escape first submits hold; failed hold keeps the dialog open with
an actionable error. Native modal focus trapping plus explicit focus restoration
keep keyboard navigation inside the editor and return focus to Add on dismissal.
The modal's canvas remains an illustration, not a framebuffer capture.
