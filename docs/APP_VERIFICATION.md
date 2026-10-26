# App verification

## Current snapshot — 26 October 2026

- Canonical repository: https://github.com/Biryukovlex/lotus-light-studio.
- Python checks: 168 passed, 4 skipped. Frontend checks: 23 passed.
- Default/Custom tabs, modal capture at chosen speed (new default 25%), saved-speed replay, local persistence and cancellation are implemented.
- Pause/Resume remains experimental; frame recall is approximate and the animated previews are illustrative.
- The title is Light studio (no trailing dot); the footer has a Git icon and linked author credit.
- Published README screenshots are [studio](screenshots/studio.jpg) and [capture](screenshots/capture.jpg).

The sections below are historical stage reports, not competing current specifications. Earlier counts, labels, layouts and statements about a held/connected device describe those stages. Current behavior is defined in [Development](DEVELOPMENT.md), [Configuration](../CONFIGURATION.md) and [the app guide](../LOCAL_APP.md). Paths under output/ or .local/ refer to private local QA artifacts and are not shipped in this repository.

## Initial app verification — 25 October 2026

## Automated checks

- Python suite: **135 passed, 4 skipped**, exit 0 (14.50 seconds). No backend
  behavior changed during the frontend redesign.
- Frontend suite: **11 passed**, exit 0. Covers pause/resume at speed 0, failed
  writes, repeated clicks, disconnected controls, initial held state, empty
  search, all 213 programs through pagination, offline category/preview selection,
  palette derivation, paused main illustration, reduced motion and hidden pages.
- JavaScript syntax and Git whitespace checks passed.
- Wheel build passed. Its archive was inspected for the latest playback,
  catalog and preview code and the absence of unsupported custom editors.
- Final running API: connected, hold requested; mode catalog is exactly 0..212.

Exact local logs and screenshots are preserved under output/qa/ (ignored by Git):
neon-python-tests.log, neon-web-tests.log, neon-build.log, neon-studio.png,
neon-gallery.png. The release package includes the two final screenshots.

## Browser and physical evidence

The redesigned Pause button was used on the connected lamp. It submitted the
hold successfully and became the large play symbol with Resume. The lamp was
left connected with hold requested. Earlier physical tests established that raw
speed 128 froze preset 138 for over a minute, and restoring normal speed 0
resumed it. Physical behavior has not been exhaustively tested on every preset.

The final browser UI was inspected at 1280px and approximately 717px widths.
Reverse category returned 34 programs; searching 138 returned the matching mode;
clearing the search restored all 213 catalog entries. These browsing actions did
not submit lamp commands. Canvas thumbnails rendered their colors and family
animations, and the main illustration remained held with the requested pause.
No browser error logs were present. The user's original app tab was refreshed
and left open; the temporary desktop QA tab was closed.

The renderer is an illustration, not an exact simulation of controller output.
Automated clock tests establish preview progression/hold, not lamp frame
synchronization. Reduced-motion behavior is covered by tests; additional manual
OS accessibility testing and a Lighthouse audit were not performed. Narrower
phone layouts are implemented in CSS but were not physically resized in this
browser session. Unit tests use mocks and do not establish untested hardware
capabilities.

## Delivery

The source ZIP is exported from a named Git commit. It excludes the environment,
private device configuration, research APKs, decompilation, original backups,
credentials, and logs. The fork's original MIT attribution is preserved. The
foundation research imported no third-party application code. The wheel and
source ZIP are accompanied by SHA-256 checksums and launch instructions.

## Preview correction and fidelity feedback

Forward/back preview time direction was reversed in the shared renderer. All 11
frontend tests still pass; 168 direct rendered-motion checks covered every
running/trail variant horizontally and vertically (forward left/up, back
right/down). This verifies the requested renderer direction only. The user
subsequently reported that most program previews remain incorrect. They must
not be treated as faithful native-program previews. Candidate real renderers and
the need for native-program validation are documented in FOUNDATION_REVIEW.md.

## Night-neon palette refresh

The layout, JavaScript, lamp commands and animation behavior are unchanged. The
new palette uses plum-black surfaces, violet controls, pink playback status and
a cyan connection indicator; favicon and browser theme color match it. Browser
views at 1280px and approximately 717px were inspected with no error logs. No
lamp commands were sent during this styling pass. All 11 frontend tests pass;
wheel build and whitespace checks pass. Text contrast checked from 8.06:1 to
16.91:1 and input-boundary contrast at 4.23:1. Current captures are
output/qa/night-neon-studio.png and night-neon-gallery.png; measured ratios are
in night-neon-contrast.json. The release screenshots are refreshed to match.

## Approximate timed presets: 26 October 2026

The user accepted approximate timed replay after repeated physical tests could
not restore an exact frame. The last paired BLE off/on comparison sent hold at
258.004834 and 258.001083 ms; the user still reported a slight shift. Those are
host submission times, not lamp processing times. No native cycle boundaries,
seek command, or guaranteed loop-zero reset have been established.

The app adds private atomic recipe storage, manual capture at maximum speed,
the existing large Pause button to record elapsed time, and Replay/Edit/Delete.
Server-side replay repeats off/on → black → speed 100 → mode → timed raw-128 hold.
Manual controls or connection operations cancel the pending timer; failed writes
disconnect and never automatically retry. New sessions cancel previous sessions.

Automated verification: Python suite **156 passed, 4 skipped**; frontend suite
**19 passed**. Coverage includes real outgoing bytes through mocks, host timing,
manual pause/cancellation, concurrent starts, disconnect/failure, atomic storage,
private permissions, corrupt-file preservation, offline CRUD, capture/recipe
selection, timing edits, and browser-poll state preservation. These checks do
not establish physical frame accuracy. Logs are `.local/preset-python-tests.log`,
`.local/preset-web-tests.log`, and `.local/preset-build.log`.

Live app verification used the connected SSG-500 and actual UI controls. Capture
recorded 23.541 seconds through the large Pause button. A named recipe was saved,
survived browser reload and an app process restart, and automatically replayed to
hold. Its timing was edited to 0.258 seconds and replayed again. Final API state:
connected, mode 138, normal speed 100, hold true, target 258 ms and measured host
pause offset 259 ms. This verifies command submission and UI/task behavior;
optical recall accuracy was not re-established. Exact recall remains unsupported.

The preset panel was visually inspected at an 883px viewport with no horizontal
overflow or browser error logs. Start capture brings the primary Pause control
into view and shows elapsed time beside it. Final screenshot:
`output/qa/timed-presets.png`; API evidence: `output/qa/preset-live-verification.json`.
The local example "Cyan afterglow" remains saved; personal recipes are excluded
from source archives and wheels. The release includes the new screenshot.

## Preset tabs and capture speed: 26 October 2026

The preset editor moved into a native modal opened from Add custom preset at
the top right of the Presets section. Default retains all built-in effects;
Custom lists saved frames. Keyboard tabs expose selection and roving focus.
The popup contains its own effect chooser, speed slider, illustration, Pause,
clock and save fields. New capture speed defaults to 25% and is saved with the
recipe. Replay uses that speed. Legacy recipes without speed retain 100%.

Final automated results: **168 Python tests passed, 4 skipped; 23 frontend tests
passed**. In addition to previous contracts, checks cover speed 0 and 17 through
actual mocked BLE frames, HTTP forwarding of capture/replay speed, invalid speed
rejection, legacy-file preservation, independent modal selection, tab keyboard
navigation, local-only Add/Edit, modal Pause/save, saved-speed replay, Escape,
close-during-capture, draft isolation from polling, and offline behavior.
Logs: `.local/preset-modal-python-tests.log` and `.local/preset-modal-web-tests.log`.

Live UI check on the connected lamp selected mode 138 at **12%**, paused through
the popup after **7.736 seconds**, saved "Slow cyan", and returned to Custom.
Replay submitted speed 12 and automatically held after the saved duration. The
API reports connected, mode 138, speed 12 and hold true. This verifies submission
and app flow, not optical frame equivalence. Existing recipes remain available.

Screenshots: `output/qa/preset-capture-dialog.png` and `presets-custom-tab.png`.
The popup fits the 883px viewport, with native modal focus containment and no
browser errors or horizontal overflow. The capture illustration stays explicitly
illustrative. Source and wheel distributions include the new frontend and store
schema while excluding all private recipes and device configuration.

## Updated preview direction: 26 October 2026

The latest requested mapping supersedes the earlier horizontal direction:
Back moves left in the Default gallery; other variants move right. Horizontal
right maps to up on the vertical lamp illustration, so Back moves down there.
The renderer now explicitly maps horizontal and vertical coordinates separately.
No lamp commands or controller behavior changed.

All **23 frontend tests pass**. A separate rendered-cell comparison checks one
step of actual color/intensity movement for 104 spatial transition, trail and
running programs in both orientations: **208 checks passed**. Evidence is in
`output/qa/preview-direction-verification.json`; screenshot:
`output/qa/default-preview-directions.png`. The Default explorer was refreshed
and left open. These remain illustrative previews, not decoded native frames.

## Dropdown and author credit: 26 October 2026

Both effect selectors retain native select behavior but replace the edge-hugging
platform caret with an inset SVG chevron (16px from the edge, 44px text padding).
Forced-color mode retains the native caret. The footer now contains only
"Developed by biryukovlex", linked to the verified fork at
https://github.com/Biryukovlex/lotus-light-studio. Decorative library/modal taglines
were removed; control labels, capture status and fidelity notes remain.

All 23 frontend tests pass. Browser checks confirm the caret inset on both
selectors, the footer link target, and no console errors. No lamp commands were
sent. Screenshots: `output/qa/dropdown-arrow-fixed.png`, `author-footer.png`,
`dropdown-capture-dialog.png`, and `custom-author-footer.png`.
