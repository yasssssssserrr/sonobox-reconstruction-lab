# SonoBox Reconstruction Lab interface

Updated 26 October 2026 using the installed UI UX Pro Max skill from
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill .

## Product and implementation

An interactive research workspace for recorded tracked ultrasound, fixed
calibration comparisons, sampled probability-volume reconstruction and local
STL exploration. The existing stack is static HTML/CSS/JavaScript with pinned
Three.js 0.180.0. Preserve that stack, the scientific pipeline, asset hashes,
physical coordinates, first-frame reference and fixed calibration matrices.

## Verified guidance and application

The initial `scientific research dashboard` design-system query returned
neumorphism and a single-CTA landing pattern; these did not fit the workspace.
The one narrowed retry, `data visualization dashboard`, returned the relevant
**Data-Dense Dashboard** style and a blue/amber palette. Its enterprise sales
landing pattern is also unsuitable and is not applied. These are recommendations,
not requirements to copy unrelated page patterns.

Use an orderly grid, restrained panel borders, clear selected states, readable
data labels and a central canvas. Keep the existing semantic tokens in
`dist/apple-design.css`; do not add a competing theme layer. Blue is the primary
action color. Preserve the labeled Matrix 1/Matrix 2 surface colors across CSS
and Three.js. Use the existing system sans-serif for text and monospace for
frame IDs, timing, spacing and dimensions, following the recommended sans/mono
role separation without adding network fonts.

The `responsive canvas rendering --stack threejs` search returned container
sizing and ResizeObserver guidance. Its recorded Three.js version is newer
than this project's version; apply only the container-sizing principle already
supported by the installed renderer and controls, without upgrading dependencies.
The `touch target size --domain ux` search distinguishes native touch units from
web CSS pixels. Use generous primary controls and at least 24 CSS pixels for
compact web targets, with explicit labels and keyboard alternatives.

## Layout and behavior

- Desktop: settings, large viewer and source image in three columns; playback
  spans beneath the viewer/source. At intermediate widths the source moves below.
- Mobile: show the viewer first, behind a compact settings disclosure; retain all
  settings and wrap filmstrip thumbnails instead of shrinking their labels.
- Expanded viewer: enlarge the canvas without moving or modifying mesh geometry.
  Escape restores the workspace and focus to the expansion button.
- Playback: previous/next controls step through the existing 64 sampled images,
  preserve original source indices, stop playback and stop at sequence endpoints.
- Keep the original spring-based control feedback, native dialogs and Escape
  handling. Switch positions must update when hidden settings become visible.

## Scientific presentation

The browser demo still contains two sweeps, 64 sampled display frames each and
four frozen full-sweep STLs. Clearly distinguish the browser preview from the
full-sweep surface. Cortical predictions are not human annotations, complete
solid bones or independently validated geometry. Keep source-data provenance
and export access visible. Do not add invented accuracy statistics or claims.

## Verification

Check light/dark text and action contrast, visible keyboard focus, reduced motion,
375/768/1024/1440 widths and landscape. Exercise reconstruction, cancel/restore,
both calibrations, comparison, frame mapping, native-grid physical STL exports,
local binary/ASCII STL import and the WebGL fallback. Run asset-integrity checks;
these prove data preservation, not anatomical validity.
