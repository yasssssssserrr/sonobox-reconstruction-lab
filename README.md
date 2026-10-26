# SonoBox · Reconstruction Lab

An interactive website for the SonoBox tracked ultrasound reconstruction project. The interaction takes inspiration from the [RecON demo](http://apps.myluo.cn/RecON); its implementation and research method are independent. This site uses recorded robot tracking and the two supplied fixed single-filament calibrations.

## Explore

- Two real sweeps: 192514 (415 usable frames) and 192840 (253).
- Original B-mode images, cached float32 nnU-Net cortex probabilities, source-frame IDs, timestamps and tracked image planes. The browser package contains 64 uniform display frames per sweep, retaining original pixels and probability values.
- Four unchanged full-sweep STL exports: Matrix 1 and Matrix 2 for each sweep, in their common physical coordinate frame within that sweep. Matrix comparison never independently centers or registers the two meshes.
- Orbit, zoom, pan, view presets, opacity, wireframe, accumulating sample points, scan trajectories, screenshots and STL downloads.
- A real browser-worker reconstruction preview: 16/32/64 sampled frames, 0.8/1/1.5/2 mm voxels, adjustable probability threshold, trilinear splatting of **all** image pixels (including background sampling support), Gaussian-normalized compounding and a thresholded marching-cubes surface. This coarser sampled preview is distinct from the full-sweep 0.3 mm exports.
- Browser-local ASCII/binary STL import via file picker or drag/drop. STL unit metadata is absent, so custom files show original model units. No file is posted to a backend.
- Responsive layout, labeled controls, keyboard-operable inputs, cancelable computation and a WebGL fallback that retains image playback and downloads.

## Interface design

The 26 October interface upgrade applies the [UI UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). The research-workspace design uses clearer panel boundaries, larger labels and controls, a blue action palette, and independently checked light/dark text contrast. On phones, a settings disclosure keeps the 3D viewer near the top of the page. An expanded viewer mode provides more inspection space and returns with Escape. Previous/next buttons navigate the existing sampled frames and stop at the endpoints. Container resizing refits the camera while preserving geometry. The accepted guidance and project-specific decisions are recorded in [the design system](design-system/sonobox-reconstruction-lab/MASTER.md).

The interface applies the installed [Apple design skill](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md): system typography, a light studio canvas, solid settings panels, translucent floating tools, progressive disclosure and immediate press feedback. The appearance button persists light/dark mode locally. Calibration selection, switches, notifications and dialogs use critically damped springs that retain their rendered position and velocity when retargeted. Sliders update directly; point candidates are cached so threshold changes can render on the next animation frame.

Reduced motion snaps controls to their new state and preserves feedback without spatial movement. Reduced transparency removes backdrop blur; increased contrast uses stronger text and defined borders. Dialogs retain native keyboard/focus behavior and Escape dismissal. Presentation changes do not alter calibrations, source pixels, probability values, reconstruction workers or STL coordinates.

## Run locally

Use a current Node.js version (24 was used here). From this directory:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4317**. `dist/` is a complete static site after building and can be served by another static HTTP server. Opening `index.html` directly with `file://` is unsuitable for module workers and fetched binary assets.

The build copies the pinned Three.js modules and licenses from `node_modules` to `dist/vendor`, including worker-compatible addon imports. It does not require a runtime CDN. Set `PORT` to choose another local port. The small development server binds only to loopback and serves only `dist`.

## Asset provenance

`dist/assets/datasets.json` records source acquisition hashes, original indices, tool poses, both supplied calibration matrices, float32 probability hashes, PNG hashes, checkpoint hash and the exact STL hashes/counts. The delivered site contains the generated example assets. Their generation belongs to the separate research repository; this website repository retains the frozen browser-ready copies and their integrity checks.

Coordinates are millimetres in the first usable tool frame **within each sweep**:

```
p_local = inverse(pose_first_usable) * pose_i * calibration_mm
          * [column*spacing_x_mm, row*spacing_y_mm, 0, 1]
```

Only calibration translations are converted from metres to millimetres. Scene centering affects display only. Full-sweep STL downloads remain byte-identical to their source exports; browser-preview exports restore physical coordinates rather than exporting the centered display transform. Different sweeps have different local frames. Anatomical LPS correspondence is not verified.

Full-sweep exports use 0.3 mm voxels, Gaussian sigma 0.25 mm, minimum support 0.05 and cortex probability threshold 0.5. Browser previews retain the same physical placement and compounding idea, with fewer frames, a coarser grid, CPU accumulation and a cubic padded preview grid. Their surfaces need not match the full-resolution output. A coarse voxel can average away a thin echo: an empty preview at a high threshold is reported explicitly rather than replaced by fabricated geometry.

The model outputs are predictions, not new human reference annotations. The surfaces reconstruct observed echo ribbons, not filled bone interiors. No independent 3D geometric, calibration or subject-generalization accuracy is established by this viewer. New annotation/retraining remains a separate pending experiment. No checkpoints, full probability volumes, source annotation archives, credentials or identifying local filesystem paths are part of the runtime assets.

## Verification

```sh
npm test
npm run test:browser
```

Run the local server before the browser suite. Static checks verify 128 PNG hashes and float32 probability arrays, four unchanged STL hashes and triangle counts, calibration units, source-frame transforms, trilinear support conservation, Gaussian impulse conservation/symmetry and per-file hosting sizes. Browser checks exercise both calibrations, comparison, original frame mapping, overlay and playback, real reconstruction, physical-coordinate STL exports, ASCII/binary import, malformed files, case switching, mobile overflow, non-WebGL fallback, persistent appearance, rapid calibration selection, spring velocity continuity and reduced-motion keyboard dialogs. Screenshots and deployment evidence are in the ignored `.artifacts/` directory.

## GitHub Pages

The website is deployed from `main` by `.github/workflows/pages.yml`. The workflow installs the pinned dependencies, vendors Three.js, checks data integrity and deploys only `dist/` using GitHub Pages. Under repository Settings > Pages, the publishing source is **GitHub Actions**. Later pushes to `main` automatically update the website.

This is a standalone website snapshot, with no research repository history, credentials, checkpoints, training data archives or local filesystem paths. Only the two example sweeps and their browser assets are included. Runtime URLs are relative, so the application supports the repository subdirectory used by project Pages. The research checkout and the existing private Sites deployment remain separate.

To check a Pages-style subdirectory locally in PowerShell:

```powershell
$env:BASE_PATH='/sonobox-reconstruction-lab'
npm start
```

In another terminal:

```powershell
$env:BASE_URL='http://127.0.0.1:4317/sonobox-reconstruction-lab/'
npm run test:browser
```

Third-party dependency: Three.js 0.180.0, MIT license, shipped as `dist/vendor/THREE-LICENSE.txt`. RecON is linked as an interaction reference; its branding, code, images and datasets are not bundled.
