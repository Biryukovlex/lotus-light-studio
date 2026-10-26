# BLE protocol reference

This reference describes packets emitted by the current Python library and the subset verified for Lotus Light Studio. It is not a complete firmware specification. The upstream work targeted MELK-OA10 5F; app investigation used a Tyute SSG-500 advertising as MELK-OA10 65. Compatibility cannot be inferred from a matching name or UUID alone.

## Transport and state

Common GATT identifiers are service `FFF0`, write/read characteristic `FFF3` and notify characteristic `FFF4`, expanded in the Bluetooth base UUID as `0000FFF0-0000-1000-8000-00805F9B34FB` etc. The app verifies the selected device's configured service and write-without-response property before writes. It pins the observed platform identity rather than substituting a matching advertised name.

Close other BLE controllers before connecting. Commands use `response=False`; completion means host submission, not an acknowledgement of physical light output. The browser status contains successful controls from this connection, not a full hardware snapshot. Reconnect does not replay controls.

## Basic controls used by the app

These frames are nine bytes. Values are hexadecimal; `XX`, `RR`, `GG`, `BB` are single bytes. The second byte is command-specific, not the total wire length.

| Control | Packet | Input |
| --- | --- | --- |
| Solid RGB | `7e 07 05 03 RR GG BB 10 ef` | Each color channel 0–255 |
| Brightness | `7e 07 01 XX ff ff ff 00 ef` | 0–100 |
| Normal speed | `7e 04 02 XX ff ff ff 00 ef` | 0–100 |
| Built-in effect | `7e 07 03 XX ff ff ff 00 ef` | Catalog ID 0–212 |
| Power on | `7e 07 04 01 00 ff ff 00 ef` | — |
| Power off | `7e 07 04 00 00 ff ff 00 ef` | — |
| Experimental frame hold | `7e 04 02 80 ff ff ff 00 ef` | Raw speed 128, separate from normal slider |

The app validates strict integer ranges/booleans before writes. The reusable library generally clamps normal numeric controls. RGB is whole-lamp color, not a per-pixel command. Program 0 is Auto Play. See [the catalog](MODES.md) for all names and IDs.

The library normally waits 100 ms after writes and 500 ms after power changes. Timed replay uses optional zero cooldown on mode and hold so a target below 100 ms is not silently delayed by the default cooldown. These are host scheduling choices, not measured firmware processing guarantees.

## Pause and timed frame presets

Raw speed 128 physically held program 138 on the SSG-500 for over a minute; normal speed 0 resumed it. Speed 0 still moves slowly. Raw 255 did not pause the tested effect. Other programs/controllers and indefinite duration have not been established.

A custom preset stores mode, normal speed and elapsed milliseconds. Capture/replay performs BLE off/on, solid black, saved speed, selected mode, then raw-128 hold after the monotonic deadline. BLE off/on is not an electrical reset or a verified loop-zero reset. The clock starts at the host's mode-write submission; the lamp does not report its internal phase.

Repeated closely timed replays produced shifted frames, including after off/on. Recipes are therefore approximate, not framebuffer snapshots or exact positions within a native cycle. No measured cycle period, reset-counter or seek-frame command is implemented. The UI illustration is separate from native lamp rendering.

## Library-only timer helpers

These inherited helpers are not present in the browser UI or its command API, and have not been physically validated on the SSG-500:

| Method | Packet |
| --- | --- |
| `sync_time()` | `7e 06 83 HH MM SS WW 00 ef` |
| `set_timer_on(hour, minute, days)` | `7e 07 82 HH MM 00 00 MASK ef` |
| `set_timer_off(hour, minute, days)` | `7e 07 82 HH MM 00 01 MASK ef` |
| `disable_timer_on()` | `7e 07 82 00 00 00 00 00 ef` |
| `disable_timer_off()` | `7e 07 82 00 00 00 01 00 ef` |

Current code emits `WW = datetime.now().weekday() + 1` (Monday 1 through Sunday 7). Its repeat mask starts with `0x80`, adding Monday bit 0 through Sunday bit 6; unknown day names add nothing. `days=None` or `[]` emits `0x80`. Hour/minute inputs are clamped to 0–23/0–59.

Earlier upstream comments described a different native weekday convention. The emitted values above document current code; the intended firmware semantics and one-shot/repeat behavior need hardware validation. Do not present these as verified schedules or enable them in the UI without that work.

## Readback and unsupported paths

Lower-level trials verified legacy readback for brightness, speed and logical node counts. The normal app does not consume those packets. Reported counts 20/40 were not established as physical LED package counts. Raw RGB pixels, complete controller state, factory defaults and firmware flash have not been read out.

Native DIY RGB scene uploads, palette previews, RGB565 uploads and range-based color retention were tested without establishing arbitrary spatial control. Shrinking the output range turned the excluded tail off, so it could not accumulate differently colored segments. The unsupported editors were removed; `/api/flow` and `/api/segments` reject requests without sending BLE data.

No firmware dump/update/recovery path is verified. Historical recovery archives contain local project/settings data, not a restorable firmware image. Native app files and private research artifacts are not distributed here.

Commands beginning `7e 00 05 ...` or `7e 00 06 ...` previously hung the controller and required an electrical power cycle. They must not be used as reset/pause commands. Other packet families can have different lengths and framing; the nine-byte rule applies to the basic controls above, not every command recovered from Android.

Exact trial formats, readback fields and observed outcomes are preserved in [the controller investigation](CUSTOM_CONTROL_INVESTIGATION.md). The implementation is [controller.py](../lotus_lamp/controller.py); local HTTP/API behavior is in [Development](DEVELOPMENT.md).
