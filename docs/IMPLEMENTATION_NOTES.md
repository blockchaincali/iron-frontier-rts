# IRON FRONTIER implementation notes

## Milestone 1 — architecture stabilization

### Baseline (October 24, 2026)

- The clean Git tree did not contain `server.js`, `src/config.js`, `public/style.css`, the menu artwork, or the core engine/room tests as normal source files.
- Both `npm start` and `npm test` invoked `boot.js`. It unpacked `source.bundle.b64`, created missing files, and rewrote `server.js` on disk to add difficulty handling and Three.js routes.
- The generated baseline passed 14 tests, but a fresh working tree was mutated before any server or test code could run.
- The client already supported a Three.js view, a 2D fallback, solo difficulty selection, private room codes, reconnect identity in session storage, mouse/touch input and rematches.
- Known UX gaps intentionally remain for the next milestone: dense first screen/HUD, right-click-oriented guidance, no interactive tutorial, incomplete mobile-first control explanation, and no visual-regression test harness.

### Stabilized runtime

- `npm start` now launches the checked-in `server.js` directly.
- `npm test` uses Node's test discovery and does not generate or patch files.
- All runtime source, styles, local artwork and baseline tests are normal tracked files.
- Foundation tests cover direct-source startup, health/static routes, MIME types, source-file non-exposure, and a real WebSocket upgrade that starts a Recruit match.
- Render remains a single Node web service with `npm install --omit=dev`, `npm start`, and `/healthz`; no production configuration or deployment was changed.

### Back-out

If this milestone must be reverted, revert its Git commit. The prior revision restores `boot.js` and `source.bundle.b64` together; those two files must never be restored independently because the old bootstrap depends on the bundle and mutates `server.js` during startup.

### Deferred risks

- Rooms are in memory and intentionally require one server replica.
- Reconnect identity is convenient rather than cryptographically hardened.
- The server broadcasts full snapshots at roughly 8 Hz and has no per-client command rate limiter yet.
- Playwright interaction coverage and two-browser-context gameplay remain future QA work; Milestone 1 uses endpoint/protocol tests plus headless Chrome desktop and mobile screenshot evidence in the local `artifacts/milestone-1/` directory.

## Milestone 2 — beginner-first UX

- Replaced the dense launch form with three explicit paths: Quick Battle, Guided Tutorial, and Play With Friend. Recruit is the first-time default and each difficulty explains its intended experience.
- Added a six-stage, skippable tutorial driven by live match state. Recruitment, selection, move, attack-move, and capture steps advance only after the relevant action or authoritative snapshot; completion is stored locally and can be replayed with `?`.
- Added tap/click contextual controls, selection and command feedback, dynamic dismissible mission guidance, clearer faction/resource/objective hierarchy, unit roles, and disabled-production explanations.
- Reworked the battle layout for desktop, 360px portrait, and short landscape screens while preserving the Three.js/2D switch, room protocol, reconnect behavior, and keyboard shortcuts.
- Added a repeated Recruit newcomer test plus a Playwright-based `npm run qa:ux` flow using installed Chrome/Chromium. It completes onboarding, monitors console/request failures, checks document overflow at 360px, and captures home/tutorial/battle screenshots for desktop and mobile.

## Milestone 3 — cinematic 3D battlefield

- Replaced the basic renderer with an original coastal command theatre: procedural terrain texture, layered roads and shoreline, water, concrete pads, instanced grass and rocks, palms, barricades, supply crates, fog, ACES tone mapping, warm key light and cool rim light.
- Rebuilt every gameplay silhouette. Rifle entities are armored multi-soldier formations with helmets, visors, packs, weapons and gait motion; tanks have tracks, wheels, sloped armor and recoiling cannons; batteries have tracked chassis and individual missiles; faction HQs and turrets have distinct Azure/Crimson profiles.
- Connected muzzle flashes, recoil, projectile trails, rocket smoke, hit sparks, impacts, destruction, relay capture energy and the orbital beam/shockwave to authoritative snapshots. Projectile snapshots now expose only the source identifier needed to associate the effect with its firing unit.
- Added smoothly interpolated perspective camera zoom/pan, pinch input, reset/focus controls, keyboard rotation, WebGL context-loss handling, adaptive high/balanced quality and live renderer telemetry.
- Added `npm run qa:3d` for real WebGL desktop/mobile execution, console and request-failure monitoring, 360px overflow validation, renderer telemetry and before/after, close-up, combat, orbital, mobile and 2D-fallback screenshots. Headless results use Chromium SwiftShader and therefore document a software-rendering lower bound, not representative hardware performance.
- Added renderer regression tests for lifecycle/quality APIs, instancing, local-only assets, 2D and contextual-control preservation, and projectile/VFX integration. See `ART_DIRECTION.md` and `ASSET_CREDITS.md` for the visual system and provenance.

## Milestone 3.5 - premium visual quality gate

- Added original local 1024 px terrain and faction armor art plus a transparent cinematic impact sprite. The renderer applies the surfaces with metal/rough materials, bump detail, anisotropic filtering, faction-specific panels, emissive identification, and no runtime network dependency.
- Re-authored unit and structure assemblies with chamfered armor, vents, lamps, kneepads, visors, muzzle brakes, wheel hubs, missile fins, stabilizers, conduits, beacons, and visibly different Azure/Crimson HQ crowns. Added type/team identification sprites, layered selection rings and deterministic spacing offsets.
- Enriched the coastal theatre with tactile ground, cracked road surfacing, lane marks, layered shoreline foam, physical water, stronger atmospheric depth, three-point faction-readable lighting, and camera framing that keeps HQs and selected forces inside the view.
- Reworked impact presentation around authoritative events: bounded muzzle sparks, smoke, recoil, projectile impacts, destruction flashes, debris, persistent scorches, and a three-beat orbital telegraph/impact/aftermath with camera impulse. Effects are capped by family to avoid runaway crowded-battle cost.
- Fixed the blank 3D tactical minimap by continuing its 2D paint loop while WebGL owns the main battlefield. Expanded the 360 px battle viewport and compacted supporting controls without shrinking primary touch targets below 40 px.
- Added mouse-wheel and pinch assertions, minimap pixel validation, an orbital-impact capture, identical default-camera A/B capture, and five sustained one-second crowded-battle performance samples to the WebGL QA harness.
- High-quality soft shadows update at a controlled cadence; balanced mobile mode keeps full gameplay silhouettes and effect categories with fewer meshes, no dynamic shadows, and a 1x pixel ratio.
- Final headless Chrome measurements used real WebGL 2 through ANGLE on Intel UHD Graphics 620. The latest high-quality desktop samples were 2, 55, and 61 FPS (a cold-start stall followed by a 58 FPS warm average); 360 px balanced emulation sampled 8, 60, 61, 60, and 61 FPS (50 average including warm-up); and a 14-15-unit high-quality crowded battle sampled 57, 53, 42, 42, and 44 FPS (48 average, 42 minimum). These are browser/hardware-specific measurements, not claims about physical mobile devices or all desktop systems.
- Final-quality classification and the remaining authored-GLB/skinned-animation gap are recorded in `ASSET_CREDITS.md`. `ASSET_PRODUCTION_WORKFLOW.md` defines the original Blender/glTF asset contract needed to close that gap without mislabeling procedural meshes as final hero art.
