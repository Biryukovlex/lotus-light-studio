# Custom control investigation: Tyute SSG-500 / MELK-OA10

## Outcome

The user confirmed the built-in functions and pure red, green, and blue controls
work. The two requested custom regimes remain unavailable on the tested lamp:

1. Two or three chosen colors moving along the lamp, with adjustable speed.
2. Independent static colors for sections of the lamp.

The native Android application's custom command paths were recovered and tested.
The user observed **no visible change** from either the static scene upload or
the palette preview. The application also excludes the `MELK-OA` family from its
DIY scene capability list. This is evidence against using those native commands
on this controller; it does not prove that every undocumented firmware command
is impossible.

The unsupported spatial-flow and segment editors have been removed. The current
Custom tab contains timed recipes for built-in effects, not custom pixel data.
Successful BLE submission is not evidence of physical playback, and a whole-lamp
fade does not satisfy spatial flow.

A subsequent lower-level investigation found working **readback** and a working
global output-range command. Neither supplies independent RGB data. Uploading
with the reported scene size still failed, and a range-based workaround was
physically ruled out: shortening the range turns the remaining LEDs off.
See the follow-up below for the exact responses and controlled tests.

## Source and reproducibility

Static analysis used the shipped Android application:

- Package: `com.szelk.ledlamppro`.
- Manifest version: `5.21.01`, version code `423`.
- APK size: `269341005` bytes.
- SHA-256: `1eb25ee796565988464a446e591d74d34f07169c6f5a7679af74b08b75ab0f47`.
- Signing-certificate SHA-1: `82A1156F9D0B365E37F6D7BD44C05D0F4574C1FB`.
- The certificate matches the independently published APKPure fingerprint.

The package was downloaded through the [Aptoide listing](https://lotuslamp-x.en.aptoide.com/app).
The developer's [Google Play listing](https://play.google.com/store/apps/details?id=com.szelk.ledlamppro)
identifies the application. Analysis was static; the Android application was not
executed or installed on the computer.

Original binary, metadata, extraction scripts, bytecode, targeted decompilation,
test frames, and trial results are preserved privately under `.local/research/`.
These proprietary source artifacts and the lamp's private Bluetooth identity
are excluded from Git. Protocol facts are documented below without distributing
the application or its decompiled implementation.

## Native capability gates

`LPHelper.isSupportedScenesDIY` recognises `MELK-OD`, `MELK-OE`, `MELK-OF`,
`MELK-OG`, `MELK-OH`, their supported variants, and several other named product
families. `MELK-OA` is absent.

`isSupportLightStripDIY` enables the extended strip configuration for the
`MELK-OF` family and LED Constellation Lights. `isEnhancedSceneDIY` selects a
different RGB565 upload for `MELK-OG` and `MELK-OH`. Native frame formats therefore
cannot be assumed interchangeable merely because devices share GATT UUIDs.

## Recovered scene upload

`E1DIYAchieve` and `BlePackagingDevice.setSceneDIY` implement these nine-byte
frames, distinct from ordinary E1 controls:

| Purpose | Layout |
| --- | --- |
| Start | `7e 32 length_lo length_hi checksum_hi checksum_lo ff ff ef` |
| Two RGB nodes | `7e 33 R1 G1 B1 R2 G2 B2 packet_index` |
| End | `7e 34 mode gradient speed ff ff ff ef` |

The data packet index begins at 1 and replaces the ordinary footer. For an odd
node count, the final missing RGB triple is padded with `ff ff ff`. Length is
three times the node count. Checksum is the unsigned sum of all bytes of all
frames, modulo 65536, with the start frame's checksum bytes initially zero.
It is stored high byte first at positions 4 and 5 of the start frame.

Relevant mode values are static `0`, forward flow `3`, and reverse flow `4`.
Gradient flag `0` disables brightness modulation. The native SDK uses 75 ms
between DIY packets. The trial used 100 ms.

The trial used the SDK's default of 15 logical nodes, grouped into five red,
five green, and five blue. This default is **not** a measurement of the lamp's
physical LED count. The user reported no visible change.

## Recovered palette preview

`E1ColorfulDIYAchieve`, `setColorfulDIY`, and
`BleTDManager.setPreviewColorfulDIY` construct a 57-byte frame:

```text
7e 07 de brightness speed mode save_flag color_count
[16 RGB triples, unused triples padded ff ff ff]
ef
```

Native preview uses `save_flag=0`; save-to-device uses `1`. The trial used only
preview. UI resources and call sites identify Gradient as mode `221`.

The trial sent brightness `100`, speed `20`, mode `221`, preview flag `0`, and
red/green/blue colors. The characteristic's negotiated maximum write size was
509 bytes, so the complete 57-byte packet fit one write without fragmentation.
The user reported no visible change. A positive palette result alone would
still not establish spatial segment control.

## Read queries and connection handling

With notifications enabled on `FFF4`, the following native queries yielded no
notifications during the observation windows:

```text
GET_SCENE_DIY:                 7e 07 36 ff ff ff ff 00 ef
GET_SET_SCENE_DIY_FOR_LIGHT_STRIP, read flag:
                              7e 07 37 ff ff ff 00 ff ef
```

The normal local app connection was released for these direct tests and restored
afterwards. No reset, firmware-flash, preset-save, or permanent channel-remapping
command was sent.

## Remaining requirement

There is still no verified pixel, section, or arbitrary spatial-palette command
for this lamp. The user requires a **software-only solution**; controller
replacement is outside the agreed scope. Further work needs additional
manufacturer protocol information or firmware evidence. No available firmware
update or successful software-only implementation has been established.

## Final pass through the MELK-OA/Symphony paths

The additional native command paths inspected do not provide arbitrary spatial
RGB data:

- `setSymphonyMode` sends a preset ID and the Symphony mode selector.
- `setSymphonyCollectMode` sends a list of collected preset IDs and collection
  types. It does not upload a palette or a framebuffer.
- `sendRGBColorForAudio` sends one RGB triple with the audio flag `0x20`. It has
  no pixel or segment address.
- `symphonyMicRhythmMode` selects a built-in rhythm ID.
- `pointSetting` changes the global SPI LED count; it does not select a pixel
  for independent color control.

No new lighting test was justified by these paths. Their existence does not
establish a means to synthesize the requested modes, and an ordinary whole-lamp
fade remains outside the requested behavior. This is a boundary of the verified
interface, not proof that every undocumented firmware command is impossible.

## Lower-level follow-up: readback, transport, and range control

### Fresh responses were available through FFF3

The earlier query trials watched notifications on FFF4. Reading FFF3 after each
query reveals real responses. The returned characteristic value is 54 bytes;
the following nine-byte packets are followed by zero padding:

| Query | Fresh response | Verified interpretation |
| --- | --- | --- |
| `7e 07 36 ff ff ff ff 00 ef` | `7e 07 36 14 14 ff ff 88 ef` | Native parser reads byte 3 as 20 scene nodes; the other `14` is not interpreted here |
| `7e 07 37 ff ff ff 00 ff ef` | `7e 07 37 28 00 ff 00 88 ef` | Native parser reads bytes 3–4 as 40 total nodes, little-endian |
| `7e 07 84 ff ff ff ff 00 ef` | `7e 07 84 32 19 64 f0 00 ef` | Legacy information/state response; brightness and speed fields verified below |

Alternating the two node queries changes the readback opcode and values, proving
these are fresh responses rather than an unchanging cached value. There were
still no notifications. The newer native E2 information query
`8e 05 84 ff ff ff ff` did not replace the previous readback value, whereas its
legacy E1 equivalent did. This is a real dialect difference on this controller.

The scene and total-node counts are controller address units, not a verified
count of physical LED packages. A successful metadata query does not establish
support for uploading custom colors. The `88` markers above belong to the query
responses; they are not acknowledgements of a scene upload.

Evidence: `.local/research/readback-query-results.json` and
`legacy-info-query-results.json`.

### Correctly sized native uploads still did not display

The legacy scene trial was repeated with the freshly reported **20 scene nodes**,
using seven red, seven green, and six blue nodes. It used the same native
checksum, packet order and 100 ms minimum pacing as the previous trial, and
captured FFF3 readback after every packet. The user reported no visible change.
Readback remained the preceding node-query response; no upload acknowledgement
was identified. This rules out the earlier SDK default of 15 nodes as the sole
cause of failure.

The alternative native `setEnhancedSceneDIY` format was also tested. It is a
110-byte packet beginning `7e 39 14`, containing little-endian RGB565 colors,
padding unused slots to 50 colors, followed by static mode, gradient, speed,
used-color count, padding, and footer. It used the same 20-node RGB bands. The
user again reported no visible change; no new upload acknowledgement appeared.

The Android transport was traced through `Ble.write`, `WriteRequest.write`,
`BleRequestImpl.wirteCharacteristic`, `submitCharacteristicWrite`, and
`executeGattOperation`. This normal path submits the entire supplied value in
one characteristic write. The SDK has a separate `writeEntity` path for explicit
fragmentation. The tested palette and enhanced-scene methods use the normal
path, and both packets fit the lamp's negotiated 509-byte write limit. Automatic
20-byte fragmentation in that native path therefore does not explain the failed
tests. The native preview/apply call sites also showed no extra custom-mode
unlock operation before these uploads.

Evidence: `sized-static-scene-results.json`, `rgb565-static-scene-results.json`,
`custom-entry-trace.json`, and `android-transport-review.json`, all under the
private `.local/research/` directory. Both physical outcomes were recorded there.

### Global range control works, but cannot layer independent colors

The legacy MELK frame below successfully changes the reported total-node count:

```text
7e 07 21 count_lo count_hi 00 ff 00 ef
```

This layout also appears in the independent
[vmui MELK transport](https://github.com/dragos-catalin/vmui/blob/main/ambilight/ble_lights.py).
The controller was tested with a bounded **40 → 20 → 40** sequence. Fresh `37`
queries returned 40, then 20, then 40. The modern native `pointSetting` path uses
a different E3 packet (`2e 21 ... 2f`, 128 bytes); that format left the reported
value at 40 on this lamp. The two dialects must not be conflated.

A possible software workaround was tested: paint the full range blue, shorten
the output range, and paint the shorter range green, hoping the untouched tail
would retain blue. Observations were:

1. After restoring the full range, the whole lamp was green.
2. While holding the shorter range, the first half was green and the second half
   was off.
3. In a separate isolation trial, the full lamp was painted blue and the range
   was shortened **without sending any further color command**. The first half
   was blue and the second half was off.

The range change itself therefore clears the excluded portion. This rules out
that prefix-retention workaround, including the proposal to substitute a
different color command after the range change. Range control is not a way to
accumulate differently colored sections on this firmware.

Every count trial sent the original value of 40 in its cleanup and verified a
fresh reported count of 40. Observation holds also had an automatic 90-second
cleanup deadline and were released when the user answered. The app's normal
Bluetooth connection was restored afterwards.

Evidence: `prefix-count-e3-results.json`, `prefix-count-e1-results.json`,
`prefix-count-hold-results.json`, and `prefix-shrink-only-results.json`.

### A partial settings snapshot is now available

Legacy INFO response offset 5 reports brightness and offset 4 reports speed.
These fields were verified by controlled changes and exact restoration:

- Brightness: 100 → 49 → 100, with only offset 5 changing.
- Speed: 25 → 26 → 25, with only offset 4 changing.
- The complete nine-byte INFO packet returned to its original value afterwards.

Offsets 3, 6 and 7 were not decoded by a controlled test. In particular, the
remaining values must not be called a firmware version or a fully decoded active
mode. The snapshot is current settings evidence, not factory defaults or a
firmware image. Raw colors, the complete internal configuration, and firmware
flash contents have not been read out.

Evidence: `status-field-mapping-results.json` and `controller-known-settings.json`.
The existing browser app does not yet consume these readback packets.

### Feasibility boundary after the follow-up

There is still no verified operation to write independent node colors on this
SSG-500. Neither requested regime can yet be implemented reliably from the
verified commands. The evidence is consistent with a firmware/interface
limitation, but does not prove that every undocumented command is absent.

Further progress needs a new per-node/palette command with demonstrated behavior,
or a matching firmware image and a verified recovery/update path. No such image
or recovery path was found, and no firmware modification, reset, protection-code
change, or channel remapping was attempted. Generic OTA UUID defaults in the
Android BLE library are not evidence that this particular lamp exposes OTA.
The working basic controls remain available; unsupported spatial editors are absent
from the current app. The original recovery archive was left intact.

## Reversible experimental frame hold

After reconnecting the local app, moving preset 138 was started at speed 50 and
then set to speed 0. The user observed that it was still moving, just slowly.
Speed 0 therefore does not freeze this tested preset.

The native Android speed setter accepts a byte, so controlled trials explored
values beyond the app's normal 0–100 range. Raw 255 was confirmed by legacy INFO
readback, but the user reported the same slow movement. Raw **128 (`0x80`)** was
also confirmed by readback, and the user reported a **completely frozen** pattern.
Restoring speed 0 made the pattern move again. After reapplying 128, the user
confirmed that it stayed completely still for over a minute.

The exact hold frame is `7e 04 02 80 ff ff ff 00 ef`; resuming at speed 0 sends
`7e 04 02 00 ff ff ff 00 ef`. These are speed commands, not a newly verified
pause opcode. The Android enum's separate `STOP_PLAY` value of `0x80` is not
evidence about the semantics of this speed byte. No firmware image was available
to establish whether the observed behavior is a deliberate hold or a timer edge
case. Indefinite duration and other presets have not been verified.

The current app offers a large **Pause/Resume** transport, with another Pause
control inside the custom-preset capture dialog. The underlying hold remains experimental. Resume sends the speed currently selected in the app;
ordinary speed changes and applying an effect also resume normal playback.
This can retain a preset's multicolor frame, but does not provide chosen
per-segment colors or change the preset's fixed palette. Both originally
requested custom regimes remain unsupported.

Evidence under `.local/research/`: `speed-zero-pause-test.json`,
`extended-speed-255-results.json`, `extended-speed-128-results.json`, and
`persistent-hold-check.json`. The first two extended-speed trials restored their
original speed in cleanup. The later persistent hold intentionally has no
automatic resume; the local app remains connected with hold requested.

## Current timed preset behavior

Subsequent replay tests compared program 138 at a 258 ms host-timed offset,
including single-connection writes and BLE off/on normalization. The user still
observed shifts; host write precision did not establish a native cycle-zero point.
There is no verified frame seek, phase readout or cycle period.

The user accepted approximate recipes. Presets → Custom now saves mode, chosen
speed and elapsed milliseconds. Add custom preset opens the capture popup,
defaulting to 25% speed; replay uses the saved speed. This is not the originally
requested arbitrary custom-color flow/segment control. See [the app guide](../LOCAL_APP.md)
and [API/task behavior](DEVELOPMENT.md). Trial evidence above is historical;
statements about a test leaving the lamp connected describe that trial, not a
current live device status. Private research files are not part of the repository.
