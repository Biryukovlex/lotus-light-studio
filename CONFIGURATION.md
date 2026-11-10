# Configuration and local storage

## Browser app

The app controls one connected lamp at a time. Scan/select in the UI, or reconnect the exact saved device. It verifies the configured service and write-without-response characteristic before enabling commands. It does not fall back to another device with the same name.

In a source checkout, private files live in `.local/`. The Windows app (`.exe`) keeps them in `%LOCALAPPDATA%\Lotus Light Studio` instead, with its log:

| File | Contents |
| --- | --- |
| `app-device.json` | One saved device: name, exact platform Bluetooth identity and GATT UUIDs |
| `app-device.presets.json` | Versioned custom recipes, independent of the current connection |
| `app-device.settings.json` | Whether [SignalRGB sync](docs/SIGNALRGB.md) was on, so it can resume at launch |

These files are ignored by Git. Successful saves use a temporary file, rename and mode 0600. Device save failure leaves the connection usable but shows a notice. Invalid preset files are preserved; edits are refused instead of overwriting them. Back up these two files yourself if you want to retain local settings. They are not firmware backups or factory defaults.

Choose a writable custom location with:

```sh
.venv/bin/python -m lotus_lamp.app --config "$HOME/.local/share/lotus-light-studio/device.json"
```

Presets then live alongside it as `device.presets.json`. The default location is relative to the installed package, not the shell's current directory. Use `--config` when running an installed wheel from a location you cannot write to. `--port 8430` changes the loopback port; `--signalrgb-port` changes the SignalRGB UDP port (default 8421); `--no-browser` prevents automatic browser opening.

### Device file

The app writes a single device object, not the library's multi-device wrapper:

```json
{
  "name": "My lamp",
  "address": "platform Bluetooth identity from a scan",
  "service_uuid": "0000FFF0-0000-1000-8000-00805F9B34FB",
  "write_char_uuid": "0000FFF3-0000-1000-8000-00805F9B34FB",
  "notify_char_uuid": "0000FFF4-0000-1000-8000-00805F9B34FB"
}
```

An address can be a platform UUID rather than a MAC address. Select the real device in the UI; placeholders are not connectable identities. Reconnection itself sends no lighting command and clears recorded control values. Status reflects successful commands in the current connection, not a full hardware readback; phone/remote changes are not tracked.

### Preset file

```json
{
  "version": 1,
  "presets": [
    {"id": "opaque-id", "name": "Evening", "mode": 138, "speed": 25, "pause_ms": 2000}
  ]
}
```

Up to 100 recipes are supported. Names contain 1–80 nonblank characters; mode is 0–212, speed is 0–100, and `pause_ms` is an integer from 0 to 600000. Missing speed in an older version-1 recipe defaults to 100; reading it does not rewrite the file. New UI captures default to 25% and remember the last chosen capture speed in that browser session.

A recipe stores elapsed time at its saved speed, not a pixel buffer or native cycle position. Brightness is not part of the recipe. There is no automatic preset execution on launch/reconnection. The app no longer uses old flow/segment drafts; browser drafts left by older versions are untouched.

## Reusable library and CLI tools

This configuration is separate from the app's `.local` files. The optional wizard (`python -m lotus_lamp.setup`) helps discover a device and write a library configuration. Explicit `DeviceConfig` is equally valid; the wizard is not mandatory.

```python
from lotus_lamp import DeviceConfig, LotusLamp

lamp = LotusLamp(device_config=DeviceConfig(name="My lamp", address="observed-device-identity"))
```

Without `device_config` or an explicit `config_path`, `ConfigManager` selects the first existing file in this order:

1. `./lotus_lamp_config.json`
2. `./.lotus_lamp.json`
3. `~/.lotus_lamp/config.json`

An invalid first file raises an error; it does not fall through to later files. The library accepts either a single device object or `{"devices": [...]}`. Names identify entries in the multi-device wrapper; the first entry is the default.

```python
from pathlib import Path
from lotus_lamp import ConfigManager, LotusLamp

lamp = LotusLamp(config_path="lamps.json", device_name="Living room", verbose=True)
manager = ConfigManager(Path("lamps.json"))
print(manager.list_devices())
```

`ConfigManager` also provides `add_device`, `remove_device`, `get_device`, `get_default_device` and `save(Path(...))`. Changes are in memory until saved. `LOTUS_LAMP_VERBOSE=1` enables library configuration/debug output. There is no implemented environment variable for overriding the app's device path; use `--config`.

The library's normal connect path can perform name-based discovery; the browser app deliberately bypasses that fallback. See [development](docs/DEVELOPMENT.md) and [examples](examples/README.md). Keep real addresses, credentials and recovery archives out of commits and issue screenshots.
