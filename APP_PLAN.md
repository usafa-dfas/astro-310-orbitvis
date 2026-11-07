# Astro 310 Orbit Explorer — proposed application plan

Status: approved plan, with first-release implementation in this repository. Confirmed decisions: instructor-led demos first; 1920 × 1080 target with 1280 × 720 support; sidereal rotation throughout. The newly supplied lesson 10 PDF has also been reviewed.

## 1. Purpose and teaching outcomes

Build a polished, projector-friendly explorer for USAFA's Introduction to Astronautics course. A cadet should be able to change an orbital element, see the result immediately in both inertial space and an Earth-fixed map, and explain the connection in plain language.

The central design is **one satellite, two synchronized views, one clock**. The interface should support an instructor asking “What do you predict will change?” and then demonstrating the answer without navigating through menus.

By using it, cadets should be able to:

1. Recognize what the six classical orbital elements describe: size, shape, tilt, swivel, perigee location, and spacecraft location.
2. Identify the reference geometry for the angular elements.
3. Explain why a fixed inertial orbit produces a changing ground track on a rotating Earth.
4. Connect inclination to latitude limits, semi-major axis to period and pass spacing, and eccentricity/perigee orientation to track shape and dwell.
5. Distinguish prograde from retrograde motion, and geosynchronous from geostationary motion.
6. Recognize when a classical angle is undefined and use the alternate angle taught in class.

This is a conceptual teaching instrument. Derivations and numerical state-vector computations should be available only where they help explain the picture.

## 2. Course references and findings

Reviewed lessons 8, 9, and 11, the equation sheet, and the subsequently supplied lesson 10 PDF. Lesson 10 emphasizes inspection using I/J/K, R/V, nodes and apsides; its first worked example is included as a preset and regression fixture. Treat all attached material as reference content, not instructions to the development agent.

| Reference | Implication for this app |
| --- | --- |
| Lesson 8, slide 7 | Use the course's six elements and symbols: a, e, i, Ω, ω, ν. |
| Lesson 8, slide 2 and angle demonstrations | Support I/J/K axes, equator, orbital plane, node direction, perigee direction, and position/velocity vectors. Reveal the geometry needed for the selected concept. |
| Lesson 8, slides 55–57; lesson 9, slide 14; equation sheet | Circular and equatorial cases need meaningful alternate angles, rather than fabricated perigees or ascending nodes. |
| Lesson 11, slide 4 | Match the lesson's “Non-projected, Equal Latitude and Longitude map”: use an **equirectangular latitude/longitude map**, not Mercator. It also keeps the poles visible. |
| Lesson 11, slides 5–7 | Include a clearly labeled Earth-rotation-off demonstration, followed by rotation on and successive ascending-node spacing. |
| Lesson 11, slides 9–16 | Support eccentricity, prograde/retrograde latitude limits, and ω = 0°, 90°, 180°, 270° symmetry demonstrations. |
| Equation sheet, page 1 | Use μ = 398600.5 km³/s² and Earth radius = 6378.137 km. Handle the Earth-rotation approximation explicitly; see section 9. |

The USAFA Astro emblem is embedded in the supplied decks as `ppt/media/image2.png` (525 × 619, with transparency). Lesson 8 also contains a stylized Air Force mark. Use the Astro emblem in the header at a modest size; preserve its proportions and original artwork.

The linked live reference sites were inaccessible under the current network policy. Source inspection of the accessible `usafa-dfas/Astro-445` repository showed the shared instrument-console styling: restrained panels, light/dark themes, compact numerical typography, semantic colors, and sliders with numeric inputs. The exact two linked explorers were absent from its current checkout. Carry that visual language forward with substantially larger type and fewer permanent panels; do not claim a pixel-level reproduction of the inaccessible sites.

## 3. First-release scope

Include:

- One satellite around Earth, with ideal circular or elliptical two-body motion.
- All six COEs and the applicable alternate angles.
- Simultaneous 3D Earth-centered inertial orbit and 2D Earth-fixed ground track.
- Physically correct variable speed around an ellipse.
- Playback, pause, elapsed-time scrubbing, speed adjustment, and reset.
- Selected-element explanations and reference geometry.
- A small preset collection and the course's two worked ground-track examples.
- Adjustable panel proportions, focused views, fullscreen, and projector styling.
- A single self-contained HTML deliverable suitable for GitHub Pages and local use.

Defer maneuvers, orbit transfers, perturbations/J2, atmosphere, real TLEs, live satellite data, multiple spacecraft, coverage footprints, sensor cones, numerical R/V-to-COE exercises, quizzes, and a full mission-planning interface. A before/after ghost orbit could be a later addition once the single-orbit teaching experience is clear.

## 4. Layout and visual direction

Working title: **Astro 310 · Orbit Explorer**. Use a compact branded header, a large visual workspace, shared playback controls, and a bottom COE dock. Avoid permanent analysis rails that compete with the two pictures.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ USAFA Astro   Orbit Explorer    Preset ▾    View ▾    Theme    ⛶     │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │                                  │
│     3D INERTIAL ORBIT             │     2D GROUND TRACK              │
│     Earth + orbit + satellite    │     world + matching point       │
│                                  │                                  │
│     Camera / geometry controls   │     Track span / rotation        │
├──────────────────────────────────┴──────────────────────────────────┤
│ Play/Pause   Reset time   ━━━━━━━●━━━━━━   Elapsed time   Speed ▾   │
├───────────┬──────────┬──────────┬──────────┬──────────┬───────────────┤
│ a · Size  │ e · Shape│ i · Tilt │ Ω·Swivel │ ω·Perigee│ ν · Location  │
│ value     │ value    │ value    │ value    │ value    │ value         │
│ slider    │ slider   │ slider   │ slider   │ slider   │ slider        │
├───────────┴──────────┴──────────┴──────────┴──────────┴───────────────┤
│ Selected concept: one short explanation        Details / Model ▾    │
└─────────────────────────────────────────────────────────────────────┘
```

The sketch communicates hierarchy, not exact dimensions. Target a 1920 × 1080 lecture display, with a second deliberate layout for 1280 × 720 and 1366 × 768 screens.

Visual treatment:

- Deep navy/charcoal panels with a restrained Academy-blue accent, a vivid orbit line, and a high-contrast spacecraft marker. Include an explicitly selectable bright projector theme.
- An attractive Earth with recognizable continents, subtle atmospheric rim, and a quiet background. Use readable cartography, not busy satellite imagery, on the 2D map.
- Ordinary lecture text around 22–24 px at 1080p; major values 28–36 px; diagram labels at least 20–22 px where space permits. Judge actual projector legibility, not just CSS sizes.
- Broad trajectory lines, solid label backplates/halos, and at least 44 px control targets. Critical distinctions use symbols or line style as well as color.
- Normal contrast for essential text; no translucent, low-contrast labels over Earth. Keep decorative stars, glow, and motion subdued.
- A brief explanation is always visible. Tooltips supplement it but never carry essential teaching content.

Panel behavior:

- Start with both views large and approximately balanced; initially allot slightly more width to 3D.
- Drag the divider to resize; provide keyboard-accessible resizing and a restore-layout action.
- Offer **Both**, **Orbit focus**, and **Ground-track focus**. A focus mode retains a small synchronized companion view, with a hide/restore option if a clean single view is needed.
- Keep controls outside the rendering areas and preserve the map's 2:1 aspect ratio.
- On smaller screens, use six compact value selectors with the selected control expanded, rather than shrinking every label or forcing six tiny sliders into a row. Stack the views when necessary. The lecture layout should avoid page scrolling.

## 5. COE controls and cause-and-effect behavior

Each control has its full name, symbol, current value, unit where appropriate, a slider, and direct numeric entry. Selecting its label reveals the relevant geometry and a short teaching sentence. Do not show all angular constructions at once.

| Element | Visible teaching phrase | What to emphasize |
| --- | --- | --- |
| Semi-major axis, a | Size and period | Earth-centered ellipse grows or shrinks; period and pass spacing change. It is measured from the ellipse's center to its end, not an altitude. |
| Eccentricity, e | Shape | Perigee and apogee separate; Earth remains at a focus; spacecraft spends more time near apogee. |
| Inclination, i | Tilt | Angle between the orbit's angular momentum and inertial +K; map latitude limits change. |
| RAAN, Ω | Swivel of the orbital plane | Ascending-node direction turns about +K; Ω is measured from the inertial +I direction, not Greenwich. |
| Argument of perigee, ω | Perigee's location in the plane | Perigee rotates within the existing orbital plane; orientation and track symmetry change. |
| True anomaly, ν | Spacecraft's current location | Spacecraft moves around the same ellipse, measured from perigee in the direction of motion. |

Suggested initial slider domains: a ≈ 6,600–50,000 km; e = 0–0.85; i = 0–180°; Ω, ω, ν = 0–360° with normalized equivalent endpoints. Final ranges should be checked against useful teaching presets, rather than treated as physical limits.

Validate the combination of a and e: require **a(1 − e) > Earth radius**. A minimum a by itself does not prevent an ellipse from entering Earth. Show an inline explanation and the allowable bound when a proposed value is invalid; do not silently modify another element. Low-altitude cases may carry a short note that drag is outside this model.

Editing behavior:

1. Adjusting an element pauses playback, with a clear “Paused while editing” status.
2. Both views and derived values update immediately; the camera remains stable so movement can be attributed to the element.
3. Shape/orientation edits preserve the current Earth orientation and current displayed location angle. They define a new illustrative orbit; they are not simulated maneuvers.
4. Editing ν relocates the spacecraft at the same simulation instant. Scrubbing the time control advances both the spacecraft and Earth. These must be visibly distinct operations.
5. Recompute the track for the edited state; never retain a stale trail from the previous orbit.
6. Playback updates the current ν (or alternate location angle), while the other elements stay fixed in the two-body model.

After an edit, re-anchor the model's reference mean anomaly using the current angle and simulation instant, including any change to mean motion. Retaining the previous reference anomaly after changing a would otherwise introduce an unintended position jump. The displayed past track is recalculated under the edited model; it is a prediction of that orbit's past, not a recording of previous classroom interactions.

Provide quarter-turn buttons for ω = 0°, 90°, 180°, 270° inside its expanded explanation, directly supporting the ground-track lesson's symmetry demonstrations.

### Circular and equatorial cases

These are core course content, including in the geostationary preset:

| Case | Undefined classical angles | Replacement control(s) |
| --- | --- | --- |
| Circular, inclined | ω and ν | Argument of latitude, u |
| Eccentric, equatorial | Ω and ω | Longitude of perigee, Π; retain ν |
| Circular, equatorial | Ω, ω and ν | True longitude, ℓ |

Keep the six-element overview recognizable, but mark undefined entries explicitly and present the meaningful replacement controls. Remove nonexistent perigee/node markers. Explain the reason in one sentence. Preserve spacecraft position sensibly when crossing into these cases. Use documented tolerances and correct retrograde-equatorial conventions at i = 180°; do not apply prograde angle-sum shortcuts universally.

## 6. The 3D inertial view

Default content: Earth at an ellipse focus, an orbit line, a spacecraft marker with a short direction indicator, an equatorial reference, and only the key labels. Earth rotates beneath an inertially fixed orbit. Camera movement changes the viewpoint, not the orbital elements or physical reference frame.

Direct interactions: drag to rotate the camera, wheel/pinch to zoom, and reset camera. Provide familiar camera buttons: **Oblique**, **North pole**, **Equatorial**, and **Orbit plane**. Selecting an element may suggest an appropriate view, but must not forcibly spin the camera during an explanation.

Progressively disclosed geometry:

- Equatorial and orbital planes.
- Inertial +I/+J/+K axes, with +I identified as the vernal-equinox reference direction.
- Ascending/descending nodes and the node line.
- Perigee/apogee and the eccentricity direction.
- Position R, velocity V, and angular momentum h.
- A labeled angle arc for the selected i, Ω, ω, ν, or alternate angle.

Use shared accents for the same object across views. A selectable “Show projection” option draws the Earth-center-to-spacecraft direction and marks the sub-satellite point on the globe, explicitly connecting it to the point on the map. Occluded geometry should have deliberate depth/dashed styling rather than randomly disappearing.

Keep Earth and orbit at their true relative scale; the spacecraft marker and line thickness may be enlarged for visibility and identified as schematic. Auto-fit when loading a preset; during slider edits, only expand the view if necessary to prevent clipping. Do not continually zoom away the visible size change caused by a.

## 7. The 2D ground-track view

Use an embedded equirectangular map with longitude −180° to +180° and latitude −90° to +90°. Include subdued coastlines, equator, prime meridian, and a restrained labeled graticule. The geographic map stays fixed while the point moves.

Show:

- The current sub-satellite point, in the same style as the 3D spacecraft marker.
- Recent track as a solid line; predicted track as a dashed line, with a compact legend and sparse direction arrows.
- A bounded span: initially one past orbit and two future orbits, with simple 1/3/6-orbit span choices.
- Optional ±maximum-latitude guides, perigee/apogee projections, and the next two ascending crossings.
- A compact, optional latitude/longitude readout. Longitudes use E/W or explicitly signed east-positive notation consistently.

Split trajectories at the antimeridian and handle polar crossings explicitly; no line may cut across the map simply because longitude wraps. At an exact pole, longitude is undefined: break/restart the relevant segment rather than drawing a misleading horizontal sweep.

Provide a prominent **Earth rotation on/off** teaching toggle. When off, display a persistent “Earth rotation paused — teaching model” label and freeze the rotation phase at its current orientation. The inertial orbital motion continues and the same map path repeats. Turning rotation back on resumes continuously from that phase. Reset restores the preset's normal model.

For rotation-mode or rotation-rate changes, preserve the current Earth angle, re-anchor its phase at the current simulation instant, and regenerate the entire displayed time window under the newly selected model. Backward scrubbing therefore explores the current model's predicted past, rather than replaying a history of earlier toggle settings. This keeps the timeline simple and both views mutually consistent.

An optional selected-node annotation explains “Earth turns X° during one orbit,” then relates that rotation to successive crossing longitudes. Distinguish unwrapped Earth rotation from a map longitude difference modulo 360°, particularly for long-period examples.

Perigee/apogee projected locations are not necessarily the track's most northern/southern points. RAAN is not geographic ascending-node longitude. Make both distinctions clear in contextual explanations.

## 8. Playback, metrics, and presets

Start **paused** on a teaching ellipse: a = 12,000 km, e = 0.25, i = 45°, Ω = 30°, ω = 45°, ν = 30°. Its perigee and apogee altitudes are approximately 2,622 km and 8,622 km; its period is about 218.0 minutes. This provides an immediately legible ellipse, focus offset, tilted plane, and defined angles.

Use a fixed, documented Earth reference orientation at t = 0 rather than current wall-clock time. That makes class demonstrations reproducible. Hide its technical angle setting under model details; this version does not need dates, UTC, or a mission epoch picker.

Playback includes play/pause, reset time, a bounded elapsed-time scrubber, and a few clear speeds. Choose an initial speed that completes the teaching ellipse in roughly 30–60 seconds; show the actual simulation multiplier. Use the same clock for both views, independent of rendering frame rate. Reset time and reset the entire scenario are separate actions.

Keep derived metrics limited to period, perigee altitude, apogee altitude, and maximum latitude. Expand instantaneous altitude, speed, latitude/longitude, and equations only on request. Do not add time-series plots to the first release.

| Preset | Purpose / suggested question |
| --- | --- |
| Teaching ellipse | “Which element moves perigee without tilting the plane?” |
| Circular inclined LEO, approximately 500 km altitude and i = 45° | “Why does the next pass move west?” Introduce u. |
| Circular polar orbit | “Why can this orbit pass over both poles?” |
| Retrograde orbit, i = 120° | “Why does it reach the same latitude limits as i = 60°?” |
| Geostationary | “Which conditions make the map point stay fixed?” Introduce ℓ. |
| Inclined circular geosynchronous, approximately i = 30° | “Same period—why is the map point moving?” |

Put the two worked lesson 11 examples and lesson 10 inspection example in an **In-class examples** submenu, rather than expanding the main preset list. Each preset gets one short, optional prompt. Presets reset the orbit, time, and Earth reference orientation. All use sidereal rotation; course-example prompts explain the small spacing difference from the rounded classroom approximation.

## 9. Physics and Earth-rotation conventions

Use an analytical two-body model, not uniform steps in true anomaly or a frame-by-frame numerical integrator:

1. Convert the initial location angle to eccentric and mean anomaly using quadrant-safe functions.
2. Advance mean anomaly using n = √(μ/a³) and elapsed simulation time.
3. Solve Kepler's equation with bounded iteration and a robust fallback for the supported eccentricity range.
4. Compute position and velocity in the orbital plane and rotate into inertial space with the standard Ω/i/ω rotations.
5. Rotate the inertial position into the Earth-fixed frame using the same Earth angle rendered on the globe.
6. Compute spherical sub-satellite latitude and longitude from that Earth-fixed position.

Both renderers consume the same computed physical state. Track points are predictions of that same model, not an independent drawing formula. Sample in time with enough adaptive subdivision to resolve fast perigee passes and map discontinuities. No frame-rate-dependent orbital speed, and no perigee dwell errors caused by uniform anomaly animation.

**Time-model recommendation:** default to a consistent sidereal rotation period of approximately 86,164.0905 s. With the course μ, synchronous a is approximately 42,164.17 km, matching the lesson's familiar rounded 42,164 km value. Compute that preset from the chosen rotation rate, rather than hard-coding incompatible rounded values.

The equation sheet instead gives 15°/hour, corresponding to 86,400 s. The instructor selected **sidereal rotation throughout**, so there is no second time-model setting. Worked-example prompts and the guide explain the small difference from rounded classroom values. Their orbital elements remain unchanged.

The stationary preset must stay stationary. Never combine a 42,164 km orbit with exactly 15°/hour and present the resulting drift as a conceptual property of geostationary motion. Compute synchronous a from the sidereal rate.

Model boundaries: spherical Earth, fixed spin axis, bound nonintersecting orbits, no precession, drag, oblateness, or third-body forces. These assumptions belong in a short expandable model explanation.

## 10. Delivery and implementation structure

The published artifact is **`index.html`**, with embedded styles, application code, coastlines, branding, and required visual assets. It should load through GitHub Pages or by opening the file locally, with no account, API key, backend, package installation, external fonts, map-tile requests, or runtime CDN dependency.

Use Three.js for the 3D scene, with its camera controls pinned and bundled into the HTML. Use SVG for the 2D map and trajectories, which is crisp on projectors and supports deliberate labels and segment breaks. Embed a simplified public-domain world coastline dataset and an appropriately attributed Earth texture, or use a coherent stylized globe based on the same coastline data. Preserve library licenses and record asset provenance.

Keep the code internally separated into:

- Orbital math and model constants.
- Shared scenario, simulation clock, and view state.
- 3D renderer and camera.
- 2D renderer and track generation.
- Controls, preset definitions, and explanatory content.

Development can use small source modules, a build script, and automated tests if useful, while committing the finished HTML as the ready-to-host product. The classroom user should never need that build tooling. Avoid a large UI framework for this bounded tool.

Support current Chrome/Edge and Firefox, plus a Safari check when available. If WebGL is unavailable, retain the 2D view and controls and show a clear 3D-unavailable explanation. Account for high-DPI displays without letting render resolution overwhelm classroom hardware.

## 11. Validation and acceptance criteria

### Physics checks

- Perigee and apogee equal a(1 − e) and a(1 + e); period matches 2π√(a³/μ).
- Positions repeat after one period in inertial space. Energy/angular momentum and plane orientation remain constant.
- Time advancement produces the correct unequal angular speed around an ellipse.
- ν edits change location on the same orbit. Ω edits rotate the plane about +K; ω edits rotate the ellipse within that plane.
- Maximum latitude is min(i, 180° − i), including 60° and 120° examples.
- Circular, equatorial, and retrograde-equatorial states have defined physical positions and honest alternate-angle displays.
- The map point matches the rotating globe's sub-satellite point at the same time, including after scrubbing and editing.
- With Earth rotation off, the mapped orbit repeats. With rotation on, successive ascending crossings shift consistently with Earth rotation.
- The stationary preset stays fixed to within numerical tolerance through a full sidereal rotation.

Course regression fixtures (periods are unchanged; show sidereal spacing alongside the slides' rounded spacing):

| Source | Inputs | Expected result |
| --- | --- | --- |
| Lesson 11, slides 18–19 | a = 9762.78 km, e = 0, i = 40°, Ω = 0°, u = 180° | Period ≈ 9600 s; sidereal Earth turns ≈ 40.11° per orbit (slides: 40°). |
| Lesson 11, slides 20–21 | a = 23564.65 km, e = 0.3, i = 30°, Ω = 0°, ω = 90°, ν = 90° | Period ≈ 36000 s; sidereal Earth turns ≈ 150.41° (slides: 150°); initial spacecraft at descending equator crossing. |

Use tolerances appropriate to rounded course inputs. Lesson 11 slide 25 contains inconsistent text versus its worked arithmetic; do not copy that discrepancy into a preset.

### Interaction and visual checks

- Loading the HTML requires no external network requests and produces no browser errors.
- Playback, pause, reset, presets, numeric entry, slider dragging, and time scrubbing keep both views synchronized.
- Crossing ±180° longitude and either pole never produces an erroneous map-spanning line.
- Resizing/focusing/restoring panels does not distort the map, clip controls, or change simulation state.
- Keyboard focus and accessible control names are present; arrows can adjust sliders; reduced-motion settings are respected. Spacebar playback must not interfere with typing in numeric inputs.
- Projector layouts at 1920 × 1080 and 1280 × 720 keep the main controls and both views legible. Check text, line weight, color contrast, and browser zoom manually.
- Test small a/large e boundaries, invalid text, wrapping angles, i = 0°/90°/180°, e = 0, long tracks, and repeated preset switching.
- Aim for smooth interaction on an ordinary integrated-GPU laptop; verify responsive sliders and stable animation, then reduce visual detail if needed. Avoid claiming a frame-rate target before testing representative hardware.

### Teaching checks

An instructor should be able to demonstrate each of the following with no more than a preset plus one or two controls:

1. Size versus shape; Earth at a focus.
2. Tilt versus swivel versus perigee orientation.
3. True anomaly versus elapsed time.
4. Nonrotating versus rotating-Earth ground tracks.
5. Latitude limits and prograde/retrograde motion.
6. Circular/equatorial alternate angles.
7. Geosynchronous versus geostationary motion.
8. The two supplied ground-track examples.

## 12. Proposed build sequence

1. **Physics foundation and fixtures.** Implement the shared orbital model, alternate-angle handling, time conventions, and course regression cases before styling can mask mistakes.
2. **Linked functional prototype.** Put a simple 3D orbit and 2D map side by side, driven by one clock and all six controls. Verify Earth orientation and ground-track correspondence.
3. **Teaching interactions.** Add selected-element geometry, explanatory sentences, presets, rotation-off mode, alternate-angle UI, and deliberate editing/reset behavior.
4. **Visual and classroom refinement.** Add the emblem, Earth/cartographic assets, themes, robust labels, splitter/focus modes, and projector layouts.
5. **Single-file packaging and validation.** Embed dependencies/assets, run physics and browser checks, test without a network connection, and document GitHub Pages publication.

Review points are the linked functional prototype and the classroom visual pass. They provide concrete opportunities to adjust the balance of controls and diagrams before adding polish. The plan assumes a self-contained HTML file, an equirectangular map, and a focused first release; those are recommended defaults rather than unresolved prerequisites.
