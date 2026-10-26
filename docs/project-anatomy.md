# Anatomy: a tracked-sweep inspection bench

Tier: **Figure**, one instrument, 40–80 physical parts. Start: 26 October 2026.
The object is a cutaway scanning bench: a probe rides two rails above a sample
cradle, a monitor shows its actual B-mode frame, and predicted echoes appear
in their calibrated spatial positions. Moving the source-frame control moves
the probe carriage and changes the recorded image plane. This is an explanatory
instrument, not a dimensional drawing of the acquisition robot.

## Truth and interaction

Use the existing two frozen example sweeps, their 64 sampled frames, supplied
calibrations, original images and cached probabilities. Derive illustration
points from pixels above 0.5; reduce point density for readability. Apply the
existing physical transform, then a uniform presentation scale and proper
rotation. Both matrices share each sweep's presentation transform. Never
describe sparse points as a new reconstruction or replace the existing STLs.
The four teaching stages explain acquisition, segmentation, supported fusion
and partial-surface export; final surfaces open in the existing workspace.

Synchronize sweep, calibration and frame with the workspace. Native buttons
and a range input provide keyboard/touch interaction. A user-controllable tour
pauses after interaction and when offscreen; reduced motion starts still.

## Physical parts, before geometry

- Base: four pads, four feet, beveled deck, inset work surface, four deck screws.
- Structure: four post shoes, four posts, two rail beams, four end couplings,
  four shoe screws and four beam screws.
- Sample cradle: floor, four raised retaining walls and two end cushions.
- Moving probe: two bearing shoes, carriage bridge, vertical mount, adapter,
  probe housing, acoustic aperture and four carriage screws.
- Controls: housing, inset plate, two knurled knobs, switch housing and rocker.
- Monitor: foot, column, housing, recessed display and two retaining screws.
- Identification: one engraved plate and two retaining screws.

Every physical part is recorded with its drawn shape for the Anatomy geometry
audit. The numerical image planes and sampled echo marks are data overlays.
Verify shading/order, contacts, moving clearances and line endings, then review
desktop/mobile and light/dark screenshots, reduced motion and existing controls.

Third-party kit: https://github.com/wheresryan22/anatomy, MIT, copyright 2026 Ryan.
The exact vendored source and license are in `tools/anatomy-kit/`; the runtime
license is shipped in `dist/vendor/ANATOMY-LICENSE.txt`.

## Verification, 26 October 2026

The recorded-shape audit passes for 69 solids over 41 depth states, including
moving probe clearances, support and painter order. Line-end checks report
zero floating ends in both themes at the first, middle and final resting
positions. Four-times close-ups cover the probe carriage, monitor and controls;
an eight-frame contact sheet checks spring motion.

All 12 browser tests pass, including bidirectional workspace synchronization,
native keyboard controls, reduced motion, 390/768/1024/1440 px layouts and
the non-WebGL fallback. The mobile navigation anchor clears the sticky header.
Data checks retain all 128 original PNG/probability hashes and four STL hashes,
and compare illustrated frame IDs, times and foreground counts with the frozen
manifest. Reproduce geometry checks with `npm run test:anatomy`; browser and
visual checks require the local server.
