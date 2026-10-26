# Python library examples

These optional scripts use the reusable `lotus_lamp` library. They are separate from the browser app and its `.local` device/preset files. For normal app use, follow [the app guide](../LOCAL_APP.md).

Run from the project root after installing the package. Supply a library config through the optional setup wizard or create one as described in [Configuration](../CONFIGURATION.md):

```sh
.venv/bin/python -m pip install -e '.[app]'
.venv/bin/python -m lotus_lamp.setup
.venv/bin/python examples/browser.py
```

Close the browser app's Bluetooth connection and the phone app before connecting a script. These examples send real lamp commands; they are not previews or ordinary tests.

| Script | Purpose |
| --- | --- |
| `browser.py` | Interactive terminal browsing/control of the 213 catalog entries |
| `animation.py` | Basic colors and animation control |
| `discover_and_configure.py` | Discovery/configuration demonstration; the wizard is the usual helper |
| `discover_uuids.py` | Inspect a selected device's GATT structure and suggest UUIDs |
| `multi_device.py` | Library control of multiple named configurations with asyncio |
| `timer.py` | Inherited timer helpers; not exposed or physically validated in the browser app |

A minimal direct-library pattern:

```python
import asyncio
from lotus_lamp import DeviceConfig, LotusLamp

async def main():
    lamp = LotusLamp(device_config=DeviceConfig(name="My lamp", address="observed-device-identity"))
    try:
        if not await lamp.connect():
            return
        await lamp.set_rgb(255, 0, 0)
    finally:
        await lamp.disconnect()

asyncio.run(main())
```

Replace the placeholder with an observed platform identity. UUID discovery is a heuristic, not proof of compatibility. The library's name-based fallback differs from the app's stricter identity handling. Timer weekday conventions and behavior require hardware verification before relying on schedules; see [protocol notes](../docs/PROTOCOL.md).
