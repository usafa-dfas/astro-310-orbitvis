# Astro 310 · Orbit Explorer

A projector-friendly, interactive explorer of **classical orbital elements and ground tracks** for USAFA Introduction to Astronautics. The 3D inertial orbit and 2D Earth-fixed map share a satellite and simulation clock.

## Use the app

**`index.html` is the complete application.** It embeds the code, 3D library, world map, Earth image, and course emblem. No account, backend, API key, map service, or runtime internet connection is required.

Open `index.html` in a current Chrome, Edge, Firefox, or Safari browser. For local HTTP serving, run:

```sh
python -m http.server 8000
```

Then open the local server in your browser. WebGL is required for 3D; if it is unavailable, the map, orbital controls, and teaching guide remain usable.

For GitHub Pages, publish the repository root from the intended branch using the repository's **Settings → Pages** controls. The committed HTML is already built; Pages needs no Node build step. Publishing is a separate repository-owner action.

## In the classroom

- Start paused on **Teaching ellipse**. Select an element to reveal its reference geometry, then drag the slider or enter a value.
- **Play** advances real Keplerian motion at the selected time multiplier. **Space** toggles playback outside input controls. **Reset time** returns to the scenario's time zero; **Reset scenario** restores the selected preset and camera.
- The time scrubber moves Earth and spacecraft together. Editing the location angle moves the spacecraft at the same instant. Other element edits preserve the displayed location angle and Earth orientation.
- Drag the 3D view to rotate the camera; scroll or pinch to zoom. The camera menu offers oblique, north-pole, equatorial, and orbit-plane views.
- **Geometry** reveals inertial axes, reference planes, nodes/apsides, R/V/h directions, and the sub-satellite projection. Selecting an element automatically reveals its relevant construction.
- Inertial-view labels sit in outer callout columns, clear of the globe and orbit. Thin leader lines end at the actual feature and follow spacecraft motion and camera changes. On narrow views, AN/DN identify the ascending/descending nodes and S/C identifies the spacecraft.
- Turn **Earth rotates** off to show how a nonrotating Earth changes the ground track. A persistent notice identifies this teaching model.
- **Both / Orbit / Map** adjusts panel proportions. Drag the divider, or focus it and use arrow keys. **Both** restores the balanced split.
- All six COE sliders sit in a **left control pane**, with the selected-element explanation below them. The pane scrolls independently, leaving the orbit and map at full height. **Explain** opens a larger version of the explanation.
- Use the chevron at the top of the pane to collapse it into a rail of element values. Select a value to reopen its slider. Smaller windows start with the pane collapsed so the animations keep their space.
- Panel titles and numerical readouts use single lines. Playback stays beneath the views; the bottom slider dock and full-width explanation strip have been removed.
- **Projector** selects a bright theme; fullscreen removes browser chrome. Target layouts are 1920×1080 and 1280×720. A narrower layout stacks the views.
- **Guide** contains definitions, model assumptions, keyboard controls, and a discussion prompt for the current preset.

The circular/equatorial presets use the course's alternate angles: **u**, **Π**, and **ℓ**. Undefined classical angles are shown explicitly, not as meaningful zeros.

## Physics and conventions

- Spherical Earth, radius **6378.137 km**; μ = **398600.5 km³/s²**.
- Two-body Keplerian circular/elliptical motion. No drag, precession, maneuvers, or third-body forces.
- A **sidereal Earth** throughout: one rotation in **86164.0905 s**. The stationary preset's semi-major axis is computed consistently, approximately **42164.17 km**.
- Course examples retain their supplied elements. Their ground-track spacing differs slightly from the slides' rounded **15°/hour** approximation; preset prompts identify the difference. There is no second time-model mode.
- Earth phase is a reproducible illustrative reference, not a real dated epoch. RAAN is referenced to inertial +I, not Greenwich.
- Equal latitude/longitude (equirectangular) map, matching lesson 11. Ground tracks split at the antimeridian and poles.
- Orbit and Earth share their distance scale. Spacecraft size, vector lengths, and line thicknesses are schematic.
- After edits or rotation-mode changes, past/future tracks are recomputed predictions of the current model, rather than a recording of earlier interactions.

The course material includes lesson 10's inspection example: R = [9000, 0, 0] km, V ≈ [0, 0, −7] km/s. It is available as a preset along with the two lesson 11 ground-track examples.

## Development

Node.js 20+ and npm are sufficient for the source build. Use the existing checkout; a separate worktree is unnecessary.

All ongoing edits use the continuing **`app-updates`** branch. Reuse that branch
for future changes, bringing new `main` commits into it with a normal merge as
needed. Commit and push there; reviewed updates can then be merged into `main`
without changing the development branch name.

```sh
npm ci
npm test
npm run build
```

If the environment's default npm cache is not writable, use `npm ci --cache /tmp/orbitvis-npm-cache`. Dependencies are pinned by `package-lock.json`.

Source organization:

| File | Purpose |
| --- | --- |
| `src/physics.js` | Pure orbital math, Earth rotation, alternate angles, track sampling, presets |
| `src/scene.js` | Three.js globe, camera, geometry overlays and labels |
| `src/app.js` | Shared simulation state, controls, SVG map and synchronization |
| `src/shell.html`, `src/style.css` | Semantic interface and responsive themes |
| `src/projector.css` | Left control pane, compact readouts, and classroom layouts |
| `src/assets/` | Embedded map, Earth image, and supplied emblem |
| `scripts/build.mjs` | Bundles everything into the root `index.html` |

Edit source files and rebuild. Commit the regenerated `index.html` alongside source changes so GitHub Pages stays current.

## Validation

`npm test` runs the orbital regression suite with Node's built-in test runner. It checks conservation laws, analytical cases, sidereal stationarity, retrograde/equatorial conventions, course fixtures, and ground-track discontinuities.

The browser suite requires Python's `playwright` package and Chromium (or Playwright's installed Chromium). In a development environment with those available:

```sh
npm run build
npm run test:browser
```

Set `CHROMIUM_PATH` if needed. The suite starts and stops its own local HTTP server, blocks external requests, exercises the actual interface, checks the target layouts, loads the built document with the browser offline, and tests the WebGL fallback. Results and screenshots go to ignored `test-results/`.

Chromium was exercised in this development environment using software WebGL. Projector hardware, interactive frame rate on classroom laptops, Firefox, and Safari still need direct classroom/browser checks.

## Credits

USAFA Astro emblem: supplied course lesson decks. Coastlines: Natural Earth (public domain). Earth image: three.js r160 example assets. Three.js: MIT. See `THIRD_PARTY_NOTICES.md` for sources and notices.
