# Testing Lotus Light Studio

Use Python 3.11+ for the app and its tests. Node 20+ is a development-only dependency for frontend tests; users do not need Node to run the app.

## Setup and checks

From the source checkout:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-app.lock
.venv/bin/python -m pip install -e '.[app,dev]'
.venv/bin/python -m pytest -o addopts='-q --tb=short'
node --check lotus_lamp/web/app.js
node --test tests/web_app.test.cjs tests/i18n.test.cjs
git diff --check
```

The pinned lockfile covers app runtime dependencies. Development extras are installed separately. Alternatively, `uv pip install --python .venv/bin/python -e '.[app,dev]'` installs the contributor environment.

The current checked snapshot has **190 Python tests passing, 4 skipped** (POSIX-only permission checks on Windows), and **32 frontend tests passing** (26 app, 6 i18n). These counts describe this snapshot, not a fixed acceptance threshold. No GitHub Actions workflow is currently committed; do not report local results as hosted CI results.

## What the suites verify

| Tests | Scope |
| --- | --- |
| `tests/test_app.py` | Local HTTP protections, exact identity, service checks, outgoing BLE bytes, hold/resume, timed capture/replay, speed forwarding, cancellation and failures |
| `tests/test_signalrgb.py` | SignalRGB packet format, loopback-only receiver, dedupe, burst coalescing, sustained 15/s limit, manual takeover, reconnect with backoff, busy port, remembered sync, HTTP toggle, power off/on and final-color instructions, the session-end safety net and the Windows show-window hook |
| `tests/test_presets.py` | Validation, atomic saves, private permissions, persistence, legacy speed default and damaged-file preservation |
| `tests/test_controller.py` | Library command construction and behavior using mocks |
| `tests/test_config.py`, `tests/test_modes.py` | Library configuration and actual mode catalog |
| `tests/test_scanner.py`, `tests/test_advanced_scanner.py` | Mocked discovery and GATT inspection |
| `tests/web_app.test.cjs` | Pause/busy/error state, all catalog entries, preview clock, tabs, modal capture, saved speed, Escape/close, offline editing, draft isolation and the SignalRGB panel |
| `tests/i18n.test.cjs` | Language detection, English fallback, Spanish interface and server messages, no untranslated `t()` keys |

Tests use temporary files and Bluetooth mocks. They do not establish that physical LEDs displayed the requested output. The Node suite uses a DOM/canvas test harness rather than a real browser.

## Focused runs and coverage

```sh
.venv/bin/python -m pytest tests/test_app.py tests/test_presets.py -o addopts='-q --tb=short'
.venv/bin/python -m pytest tests/test_controller.py -o addopts='-q --tb=short'
.venv/bin/python -m pytest
```

The last command uses `pytest.ini` defaults, including terminal/HTML coverage. `htmlcov/`, `.coverage` and `.pytest_cache/` are ignored. No minimum coverage threshold is configured. Markers such as `requires_device` are declared in `pytest.ini`; marker names alone do not automatically skip hardware tests. Inspect selected tests before running device-dependent cases.

## Browser verification

Check the actual page as well as the harness:

- Connect/disconnect and show useful errors; never substitute another lamp with a similar name.
- Pause/Resume updates after successful submission; speed 0 resumes slowly rather than meaning Pause.
- Default/Custom tabs support keyboard navigation. Browsing and opening/editing a draft send no BLE commands.
- Add opens the full effect chooser at 25% capture speed. Start, Pause, name and save stay in the popup.
- Replay uses saved speed/time; manual controls and connection operations cancel its timer.
- Escape/Close pauses an active capture before dismissing; focus returns to Add.
- Saved recipes survive reload/restart. Unrelated status polls do not overwrite editor fields.
- Check narrow and desktop layouts, reduced motion, dropdown arrows, footer link and browser errors.

On Windows, use `.venv\Scripts\python.exe` in place of `.venv/bin/python`, and `requirements-app-windows.lock` in place of `requirements-app.lock`.

## Physical verification boundary

SignalRGB sync was checked with real hardware as described in [docs/SIGNALRGB.md](docs/SIGNALRGB.md#code-and-tests). Re-check it after changing the plugin or bridge: SignalRGB lists the device, counters rise with an effect applied, and the lamp follows.

Obtain permission before disturbing a held frame: exact restoration is unavailable. Use a named device, preserve known settings and record what the observer actually sees. A successful write or host timer is not proof of a pixel frame.

On the tested SSG-500, raw speed 128 held program 138 for over a minute, and restoring normal speed resumed it. Timed replay shifted despite closely matched host timing, so custom presets remain approximate. Other controllers/effects need their own evidence. See [the investigation](docs/CUSTOM_CONTROL_INVESTIGATION.md) and [verification history](docs/APP_VERIFICATION.md).

Contributor changes should use checks appropriate to their scope. Extend behavioral tests for meaningful contracts; avoid testing cosmetic implementation details or making real lamp writes part of ordinary unit tests.
