# Neon lamp studio design

Reading this as: a full local controller for a personal ambient lamp, with a
neon visual language, animated program discovery, and Pause as its signature
interaction.

## Audit and direction

The earlier simplified app retained working controls but buried playback in two
small Hold/Resume buttons. An initial calm redesign made playback prominent;
the revised brief calls for a neon studio covering the entire available effect
catalog, rather than a pause-only utility.

Preserve the Lotus wordmark, single-page routes, offline assets, Bluetooth
identity checks, API protections, keyboard focus, and working controls. The
open-source foundation comparison and reasons to retain the verified control
layer are in [Foundation review](FOUNDATION_REVIEW.md).

Design dials: DESIGN_VARIANCE 6, MOTION_INTENSITY 5, VISUAL_DENSITY 4. The existing
native HTML/CSS/JavaScript architecture keeps startup simple and all assets
local. Near-black plum surfaces, violet primary controls, cyan connection status, and
pink highlights provide the requested night-neon style. Functional previews may use the full spectrum;
interactive chrome uses violet consistently, with cyan reserved for connection
status/timing and pink for playback status. System sans, consistent 12/20px corners,
subtle shadows, and tactile feedback keep the interface coherent.

## Interaction contract

- One large playback button: pause symbol + Pause; after successful pause,
  play symbol + Resume. No protocol explanation around the button.
- Resume uses the selected normal speed, including 0. Speed 0 is slow playback.
- Do not send 128 through the normal speed slider, which accepts 0..100.
- Never show a successful pause before command success. Disable hardware
  controls while disconnected or busy; connecting remains available.
- Connection state is live. Playback state is the last successful request in
  this connection, not optical confirmation or a complete hardware snapshot.
  Unknown playback state is Ready, not an assertion that the lamp is Playing.
- The entire 213-entry catalog remains reachable by search, category and Show
  more. Selecting a tile previews it without writing to the lamp; Apply effect
  explicitly submits the effect and normal speed.
- Gallery selection works offline. No automated BLE writes on page load,
  browsing, preview animation, filtering, pagination, or reconnect.
- The large illustrated strip freezes with the requested pause. Gallery
  thumbnails continue demonstrating other programs. Back variants travel left
  in horizontal previews and down on the vertical lamp; other variants travel
  right and up respectively. These are illustrations
  of families/colors, never a claim to reproduce firmware frames exactly.
- No unsupported custom-segment editor, fake frame recall, or music-control
  button. Full control means all verified controls and the native catalog, not
  unsupported features from a different controller.

## Layout and performance

Desktop: connection in the header; playback and illustrated lamp at left;
brightness, speed and solid color at right; program discovery below. Below 768px
controls stack, with playback first. On narrow phones the transport button is
shown before its illustrated strip. Connection tools expand on demand.

The large playback target is at least 174x208px, with a 148px transport disc.
Other touch targets are at least 44px. The palette is deliberately dark neon,
independent of OS light mode. Focus indicators and input boundaries retain clear
contrast. Motion respects reduced-motion preferences, draws previews at up to
20 fps, skips offscreen thumbnails, and stops progressing while the document is
hidden. Previews never generate Bluetooth traffic. Only 24 cards are initially
rendered; more are loaded on request.

The title reads Light studio without a trailing dot. The footer links a Git icon
and Developed by biryukovlex credit to the canonical repository.

Colors and category names derive from the upstream catalog rather than special
cases for individual IDs. Exact per-program timing and pixels are unknown; the
preview caption and gallery note disclose that distinction without explaining
the Pause button's implementation in the user flow.
## Preset library and modal capture

Keep the main Pause/Resume transport and night-neon theme. Under it, use a single
Presets section with Default and Custom tabs; Default contains the existing
built-in gallery, Custom contains saved frames. Put a small Add custom preset
button at the top right. Tabs expose selected state and arrow/Home/End navigation.

Add and Edit open a native modal with a violet border, dark blurred backdrop,
full effect selector, capture speed (default 25%), illustrative strip and a large
Pause control, live clock, name, timing and Save. Keep the whole capture workflow
inside the popup. Freeze effect/speed selection during an active capture; allow
capture again after Pause. Close/Escape pauses active capture before dismissing.
Save returns to Custom; replay stays in the library and uses the saved speed.

Use cyan for the timer, violet for primary controls and an Approximate recall
label in Custom and the popup. Recipe time means elapsed at the saved speed,
never a claimed native cycle phase. Opening/editing works offline; capture and
replay require Bluetooth. Render user names as text, never HTML. Keep native
modal focus containment and restore focus to Add when dismissed.
