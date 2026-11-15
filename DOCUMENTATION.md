# Lotus Light Studio documentation

The local browser app and the reusable Python library have separate setup and configuration paths.

| Start here | What it covers |
| --- | --- |
| [README](README.md) | Features, screenshots, Mac app/web app launch and contribution invitation |
| [SignalRGB sync](docs/SIGNALRGB.md) | Plugin setup, UDP bridge, rate limit, shutdown behavior, API and troubleshooting |
| [App guide](LOCAL_APP.md) | Bluetooth connection, Pause, Default/Custom presets, capture/replay and limits |
| [Configuration](CONFIGURATION.md) | App storage, preset format and separate library configuration |
| [Development](docs/DEVELOPMENT.md) | Architecture, HTTP API, frontend contracts and packaging |
| [Testing](TESTING.md) | Current local checks, mocked vs physical verification |
| [Mode catalog](docs/MODES.md) | IDs/names/categories from the actual catalog data |
| [Protocol](docs/PROTOCOL.md) | Implemented packet formats and their verification boundaries |
| [Examples](examples/README.md) | Optional Python library/CLI examples; not the browser app |
| [Changelog](CHANGELOG.md) | App additions and inherited upstream library history |

Design and research:

- [App design](docs/APP_DESIGN.md): current night-neon layout and interactions.
- [Verification](docs/APP_VERIFICATION.md): current check summary plus historical implementation stages.
- [Controller investigation](docs/CUSTOM_CONTROL_INVESTIGATION.md): physical results for custom color uploads, readback, hold and timed recall.
- [Foundation review](docs/FOUNDATION_REVIEW.md): dated comparison of other projects; no external effect engine was integrated.

For normal app use, open the built **Lotus Light Studio.app** (macOS) or **Lotus Light Studio.exe** (Windows, see the README), or launch **Launch Lotus Lamp.command** / **Launch Lotus Lamp.bat** for the web app, then scan/connect in the UI. The library setup wizard is optional and does not configure the browser app. Repository: [Biryukovlex/lotus-light-studio](https://github.com/Biryukovlex/lotus-light-studio).
