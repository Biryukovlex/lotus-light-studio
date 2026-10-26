# Open-source foundation review

Reviewed 25 October 2026 against the actual requirement: a local Mac controller
for an existing SSG-500 / MELK-OA10 lamp, all available programs, and a prominent
reversible Pause/Resume control. Hardware changes remain outside scope.

The external-project observations below are a dated research record, not a
continuously maintained compatibility/licensing check. Consult the linked
projects before reusing their code. No external renderer was adopted.

## Findings

| Project | Useful existing work | Fit for this lamp |
| --- | --- | --- |
| [LED Union](https://github.com/chameleonbr/LED_UNION) | MIT, Svelte PWA, color/effect/scene controls, multi-family BLE drivers, tests | Closest general-purpose UI reference. Its README explicitly says MELK is implemented from app code but has not been tried on hardware. Web Bluetooth would also change the current transport and browser requirements. |
| [LotusLampX](https://github.com/l0lsec/LotusLampX) | Python BLE server and fuller web controls, scene grid, color picker | Close protocol family, but generic feature claims do not establish support on this unit. Its frame construction and ranges differ from our physically verified commands. No licence file was found in the repository root during review; do not copy it as a licensed foundation without resolving that. |
| [FS Desktop LEDs](https://github.com/gitlares/fs-desktop-leds) | MIT, native macOS menu bar app, ready packaged beta, screen/audio modes | Strong ready-to-use native app candidate for its listed ELK-BLEDOM/BJ_LED devices. Its README does not establish compatibility with SSG-500/MELK-OA10 or its native 213 effect catalog and raw-128 pause behavior. The listed feature set does not establish native program/pause parity. |
| [LedFx](https://github.com/LedFx/LedFx) | Mature effect engine, desktop releases, browser control and live visualization | Designed around networked LED devices. Its documented WLED setup is not a drop-in connection to this BLE lamp. Adapting an entire effect engine does not provide a verified per-pixel command. |
| [WLED](https://github.com/wled/WLED) and [WLED-GUI](https://github.com/w00000dy/WLED-GUI) | Extensive controller UI, palettes, effects, presets, desktop wrapper | WLED is ESP32 firmware; GUI controls WLED devices. Adopting that hardware/firmware path conflicts with the agreed software-only scope for this existing controller. |
| [Hacksore/elk-bledom](https://github.com/Hacksore/elk-bledom) | Python/React BLE WebUI | Inspected server is tied to named devices, Bluepy, and busy/free use cases. It does not replace the working macOS transport and native effect coverage. |

## Decision

Keep the MIT-licensed wporter82 fork as the transport/control foundation. It
provides the 213-mode catalog and basic BLE transport. This fork adds exact-device
connection handling, loopback request protections, and the physically established
speed-128 hold behavior; these are not claims about the upstream app.
Use the reviewed apps as product references rather than importing unverified
hardware behavior. This retains the reusable open-source foundation that actually
matches this lamp, instead of replacing it solely for its interface.

The revised frontend provides a complete neon control studio: power, brightness,
solid RGB, normal speed, all 213 available catalog entries, category/search
navigation, animated illustrations, the large Pause/Resume control, and approximate
timed presets captured at a chosen speed through the Custom dialog. No third-
party application code was copied during this review; original MIT attribution
remains in LICENSE. A future native window can wrap this same control layer.

Animated previews are our illustrative rendering of the existing mode-name
colors and effect families. They are not captured lamp output or an exact
firmware simulation. Unknown commands, custom pixel palettes, firmware backup,
and exact paused-frame recall do not become supported by choosing another UI.

## Source checks

- [LED Union README / hardware verification boundary](https://github.com/chameleonbr/LED_UNION/blob/main/README.md)
- [LED Union MIT licence](https://github.com/chameleonbr/LED_UNION/blob/main/LICENSE)
- [LED Union frontend source](https://github.com/chameleonbr/LED_UNION/blob/main/src/App.svelte)
- [LotusLampX protocol implementation](https://github.com/l0lsec/LotusLampX/blob/main/cli/protocol.py)
- [FS Desktop LEDs supported devices and modes](https://github.com/gitlares/fs-desktop-leds/blob/main/README.md)
- [LedFx frontend and network-device setup](https://github.com/LedFx/LedFx/blob/main/README.rst)
- [WLED firmware scope](https://github.com/wled/WLED/blob/main/readme.md)
- [Hacksore server implementation](https://github.com/Hacksore/elk-bledom/blob/master/server/app.py)

## Follow-up: real animation implementations

The user reported that most of the illustrative native-program previews do not
match the lamp. Correcting forward/back direction does not establish program
fidelity. No exact open-source renderer for all 213 SSG-500 presets was found in
the reviewed sources.

The strongest newly found renderer candidate is
[wled-fx-sim](https://github.com/wiillownet/wled-fx-sim): TypeScript ports of WLED's
actual effect implementations producing RGB pixel buffers in a browser or Node.
Its effects package identifies itself as EUPL-1.2, with a separate MIT FastLED
math package. It is a preview library, not a driver for this lamp. Adopting it
still requires an observed mapping between a native lamp preset and an effect,
palette, geometry and timing; matching names or numbers is insufficient.

[WS2812FX](https://github.com/kitesurfer1404/WS2812FX) also supplies reusable effect
algorithms, including chases, wipes, comets, fades and direction controls. It is
an embedded C++ library, not a ready browser renderer or a verified SSG-500 map.
[pghWebLED](https://github.com/pghdriver/pghWebLED) is a browser application for
WLED preset previews, but its README explicitly reports missing/incorrect FX.
None of these is evidence that this controller runs WLED or WS2812FX firmware.

Recommended next step: compare candidate algorithms with observed native
programs before changing the gallery engine. Use recorded lamp clips when exact
native-program previews are required and no matching algorithm is established.
Do not replace one unverified family approximation with another and describe it
as a verified preview. These candidates have not been integrated into this fork.
