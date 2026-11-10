# Changelog

## Windows, Spanish interface and SignalRGB sync — 9 November 2026

Contributed by [Jose Duarte](https://github.com/josegduarte96).

- Added Windows support: `Launch Lotus Lamp.bat` with a hash-pinned `requirements-app-windows.lock`, line-ending rules and POSIX-only permission tests skipped on Windows.
- Added a Spanish interface with a language picker (`lotus_lamp/web/i18n.js`), including translated server messages.
- Added SignalRGB sync: a SignalRGB network plugin (`signalrgb/LotusLamp`) sends the whole-lamp color over loopback UDP; the app writes it over BLE at up to 15 updates/s without repeats, reconnects the lamp if the link drops, and hands control back on any manual action. See [docs/SIGNALRGB.md](docs/SIGNALRGB.md).
- SignalRGB **Shutdown Action**: the lamp is powered off when SignalRGB closes, Windows shuts down or the PC sleeps, and powered back on by the next effect color. The Windows app adds a session-end safety net and no longer cancels a Windows shutdown when it hides to the tray.
- Added a native Windows app (pywebview + PyInstaller) with a tray icon, single instance, Desktop and Startup shortcuts, and remembered sync state.

## Local app development — 26 October 2026

- Added the loopback-only neon browser app and macOS launcher, with pinned runtime dependencies.
- Added power, whole-lamp RGB, brightness, normal speed, 213-effect browsing and experimental Pause/Resume.
- Added Default/Custom tabs and a modal to capture at a chosen speed, name/save/edit/delete timed recipes, and replay with an automatic pause.
- Added private versioned preset storage, exact device identity checks, request protections and cancellation/error handling.
- Documented approximate recall, illustrative previews, tested controller limits, setup and contributor checks.
- Published project identity: Biryukovlex/lotus-light-studio. Original library package/module names remain compatible; distribution metadata remains 1.1.0.

## Upstream library history

The entries below describe earlier upstream releases; they do not establish full protocol coverage or hardware support for this fork.

## [1.1.0] - 2026-02-08

### Added
- Time/Scheduling support
- Example script

### Fixed
- Removed unicode characters in config creation
- Updated documentation with timer protocol

## [1.0.1] - 2026-02-06

### Fixed
- Fixed documentation links in README.md - now point to GitHub instead of relative paths (fixes 404 errors on PyPI)
- Fixed LICENSE link in README.md to point to GitHub
- Fixed package name format from `lotus-lamp` to `lotus_lamp` to comply with PyPI naming requirements (Note: users can still install using either `pip install lotus-lamp` or `pip install lotus_lamp`)

## [1.0.0] - 2026-02-06

### Added
- Initial release
- Basic BLE command implementation for Lotus Lamp devices
- Support for 213 built-in animation modes with official names
- RGB color control (16.7 million colors)
- Brightness control (0-100%)
- Speed control (0-100%)
- Power on/off control
- Mode search and lookup functionality
- Category-based mode organization (8 categories)
- Auto UUID discovery for different lamp models
- Interactive setup wizard
- Multi-device support
- Configuration management system
- 5 example scripts (browser, animation, discovery, multi-device)
- Comprehensive documentation (README, CONFIGURATION, TESTING, PROTOCOL, MODES)
- Test suite with 94 tests

### Documentation
- BLE command documentation
- All 213 modes documented with categories
- Configuration guide for advanced usage
- Testing guide
- Interactive mode browser example

[1.1.0]: https://github.com/wporter82/lotus-lamp-python/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/wporter82/lotus-lamp-python/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/wporter82/lotus-lamp-python/releases/tag/v1.0.0
