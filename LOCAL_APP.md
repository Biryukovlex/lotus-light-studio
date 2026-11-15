# Lotus Light Studio app guide

This fork adds a local browser app to Wayne Porter's Bluetooth library. The Python
server talks directly to the lamp; the browser does not need Web Bluetooth or a
cloud service. The server binds only to `127.0.0.1`.

On Windows, use **Launch Lotus Lamp.bat** or build the Windows app; see the [README](README.md#windows). To drive the lamp from SignalRGB effects, see [SignalRGB sync](docs/SIGNALRGB.md).

## Start on macOS

Double-click **Launch Lotus Lamp.command**. Keep its terminal window open while
using the app at **http://127.0.0.1:8420**. Press Ctrl+C in that terminal to stop it.
Launching a second time opens the existing app.

The launcher uses `uv` if installed, otherwise Python 3.11+ and pip. Dependencies
are pinned with hashes in `requirements-app.lock`. Internet access is needed for
the initial installation. The application itself uses no remote fonts, scripts,
APIs, or telemetry.

Alternatively, from this directory:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-app.lock
.venv/bin/python -m lotus_lamp.app
```

Use `--port 8421` if the default port is occupied, `--no-browser` to suppress the
browser, or `--config /path/to/device.json` to choose a different saved-device file.

### Desktop launcher

After setting up the Python environment once, you can build a native macOS window
with Xcode Command Line Tools installed:

```sh
.venv/bin/python scripts/build_macos_launcher.py --install-path "$HOME/Desktop/Lotus Light Studio.app"
```

Double-click **Lotus Light Studio.app** on the Desktop. It starts the local server
and opens the same controls in its own window; no terminal or coding assistant is
needed. Allow Bluetooth access if macOS asks, then connect your lamp.

Closing the window or pressing Cmd+Q stops a server started by this launcher and
releases Bluetooth. If a compatible server was already running, the launcher
reuses it and leaves that separately started server running when closed.

This is a locally signed wrapper for the existing checkout and `.venv`, not a
notarized standalone distribution. Keep the project in place, or rebuild after
moving it. Build output lives under ignored `output/launchers/`; the local source
path is embedded only in that generated bundle. Startup logs stay in ignored
`.local/launcher.log` with private permissions.

## Connect

1. Power on the lamp and fully close its phone app. The lamp accepts one connection.
2. Allow Bluetooth access for the terminal/application running Python when macOS asks.
3. Click **Scan for lamps** and connect to the correct advertised name.
4. The app verifies the Lotus service and writable characteristic before enabling
   controls. It remembers the exact Bluetooth identity and never substitutes another
   lamp with a similar name.

On this setup the user identified a Tyute **SSG-500** advertising as
**MELK-OA10 65**. Live read-only inspection on 25 October 2026 found service `FFF0`,
write/read characteristic `FFF3`, and notify characteristic `FFF4`. That confirms
the transport, not undocumented pixel or palette features. The app does not
hardcode this name, model, address, or number of LEDs.

## What works and what remains blocked

| Control | Implementation status |
| --- | --- |
| Scan, select, connect, disconnect, remember device | Implemented |
| Power, brightness, whole-lamp RGB color | Uses the library's documented commands |
| 213 built-in effects and speed | Searchable neon gallery, categories, illustrative animation previews; mode 0 is preserved |
| Pause a built-in effect's current frame, then resume | Experimental; physically verified on SSG-500 preset 138 |
| Save, replay, edit and delete timed frame presets | Implemented; approximate recall at your chosen speed |

**Arbitrary custom-color flow and independent segment colors are not supported on this lamp.** The library exposes a
whole-lamp RGB command and fixed animation IDs, with no documented arbitrary
pixel/segment or custom-palette upload command. The unsupported flow and segment
editors and draft-saving controls have been removed from the app. The effect
gallery previews only existing built-in programs; its animations illustrate their
color families, rather than simulating exact firmware frames. The API still rejects these operations without sending anything over BLE.

The upstream protocol document lists individual LED control and custom animation
creation as potential future work. A separate Home Assistant integration also
lists multi-zone control as unsupported. These limitations do **not** prove that
the SSG-500 firmware cannot do it. Implementing the requested regimes needs a
verified controller command or firmware support, followed by physical lamp tests.
A GATT service listing alone cannot establish that support.

Further investigation recovered native scene and palette commands from the signed
Android application. Both were tested on this SSG-500 / MELK-OA10 lamp, and the
user reported no visible change. The native app excludes the MELK-OA family from
its DIY capability list. See [the investigation and exact test formats](docs/CUSTOM_CONTROL_INVESTIGATION.md).
The agreed solution must remain software-only. Those spatial controls remain unsupported pending additional verified protocol evidence.

### Pause an effect

Choose a built-in effect and speed, then click **Apply effect**. Click the large
**Pause** button when the lamp reaches a frame you want to keep. The same button
becomes **Resume**, which uses the speed currently selected in the app. Changing the
speed slider or applying an effect also sends a normal playback speed.

Pause sends the raw speed byte `128` (`0x80`), outside the normal 0–100 range.
On preset 138, the user confirmed a completely still frame for over a minute;
restoring speed 0 resumed movement. Speed 0 by itself moves slowly, and raw 255
did not freeze the tested effect. Pause remains experimental: other presets and
indefinite duration have not been verified. It retains the preset's own colors;
it does not enable arbitrary segment colors or custom flow palettes. The UI
reports successful submission, not optical confirmation that the lamp is held.

Source evidence:

- https://github.com/wporter82/lotus-lamp-python/blob/main/docs/PROTOCOL.md
- https://github.com/dave-code-ruiz/elkbledom/blob/main/README.md
- https://github.com/l0lsec/LotusLampX/blob/main/cli/protocol.py

### Save a frame preset

1. In **Presets**, browse built-in effects under **Default**, or saved frames under **Custom**.
2. Click **Add custom preset** at the top right to open the capture popup.
3. Choose an effect and **Capture speed** (0–100; new captures default to 25%).
4. Click **Start capture**, then the popup's large **Pause** button on a frame you like.
5. Name it and click **Save preset**. The popup closes and your frame appears in **Custom**.
6. **Replay** uses the saved effect, speed and duration. **Edit** opens the popup to
   change the recipe or capture again; **Delete** removes the local recipe.

Starting capture briefly switches the lamp off/on before selecting the effect.
The chosen speed stays fixed during capture so elapsed time remains meaningful;
pause and capture again to use another speed. Speed 0 still moves slowly. You
can also enter a timing directly. Closing the popup or pressing Escape during
capture pauses the lamp before dismissing it. Opening, browsing and editing the
popup do not send lamp commands.

These are approximate timed recipes, not snapshots of LED colors or verified
positions within a repeating cycle. Physical comparisons still showed a shift
at closely matched host timings, including after Bluetooth power off/on. The
controller does not report loop boundaries or provide a verified frame-seek
command. Presets preserve the program, speed and timing; brightness stays as selected.
Older presets without a stored speed retain their original 100% replay speed.

Timing runs on the local server, so a browser reload does not stop a replay.
Manual lamp controls cancel any pending automatic pause; pressing Pause instead
captures the new elapsed time. Disconnecting or stopping the server cancels
the timer and does not automatically stop the lamp's animation. Keep the local
app running for a replay to finish. Captures stop automatically at 10 minutes.

## State and storage

Device selection lives in `.local/app-device.json`, ignored by Git. The simplified
app no longer reads or writes palette/segment drafts. Drafts saved by earlier
versions are left untouched in browser storage.

Frame presets live beside the device file in `.local/app-device.presets.json`
(or the equivalent name beside a custom `--config` file). Up to 100 named
recipes are saved atomically with private file permissions. They survive app
restarts. A damaged/unsupported file is preserved and cannot be overwritten
through the preset editor. Include this file in your own local backups; it is
excluded from source/release packages.

The app currently reports connection state and successful command submission,
and only remembers values sent during the current connection. External
remote/phone changes cannot be reflected. Failed writes are never replayed
automatically. Lower-level investigation subsequently verified legacy readback
for brightness, speed, scene-node count, and total-node count; the browser app
does not yet consume it. Current colors and complete controller state have not
been read out. See the investigation report for the exact packets and tests.

## Validation

```sh
uv pip install --python .venv/bin/python -e '.[app,dev]'
.venv/bin/python -m pytest -o addopts='-q --tb=short'
```

The app tests mock Bluetooth, check the actual protocol frames, validate connection
identity and service checks, and exercise HTTP request protections and unsupported
custom operations. Mock tests do not prove the lamp displayed a requested effect.

Developer setup, API contracts, acceptance checks, and distribution boundaries
are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). The visual specification is in
[docs/APP_DESIGN.md](docs/APP_DESIGN.md).

The app controls the verified operations listed above, with Pause emphasized.
Inherited library-only timer helpers are not exposed by the browser app or its API.
All built-in catalog entries are available in Presets → Default. Selecting a tile
changes the preview; Apply effect sends it to the lamp. Browsing previews works
offline and sends no Bluetooth commands. The open-source foundation review is in
[docs/FOUNDATION_REVIEW.md](docs/FOUNDATION_REVIEW.md).
