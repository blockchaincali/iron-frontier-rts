# Milestone 4 final QA report

Validated locally on October 26, 2026 against `http://127.0.0.1:3006` using installed Chromium with real WebGL 2 through ANGLE on Intel UHD Graphics 620.

## Automated results

- `npm test`: 26/26 passing.
- `npm run qa:ux`: tutorial completion, Recruit launch, desktop/mobile navigation, console/network monitoring, screenshots, and 360 px overflow checks passed.
- `npm run qa:3d`: desktop/mobile WebGL, interactions, combat effects, orbital impact, minimap, 2D fallback, screenshots, and sustained crowded-battle sampling passed with no harness failures.
- `npm run qa:world`: all three maps, seven camera states per desktop/portrait map, landscape fit, mouse/touch/pinch/minimap controls, WebGL recovery, 2D fallbacks, and multiplayer map synchronization passed. All 2,835 sampled viewport rays hit authored terrain.
- `npm run qa:final`: two independent browser contexts completed room join, authoritative map/seed sync, launch, recruitment, move, focus fire, guest refresh/reconnect, guest victory, host rematch, host victory, and exit. Portrait and landscape camera controls had zero rectangle intersections or horizontal overflow.

## Performance measurements

- World matrix: 52–60 FPS desktop high; 59–60 FPS emulated mobile balanced.
- 3D combat: desktop warmed to 55–56 FPS after a 3 FPS cold-start sample; emulated mobile held 60–61 FPS.
- Crowded combat: transition samples 1 and 0 FPS, then 41, 35, and 34 FPS; 1,203 maximum draw calls and 161,462 maximum triangles.

These results describe this browser and hardware only. The mobile figures use Chromium viewport/touch emulation, not a physical phone.

## Defects fixed during final QA

- Multiplayer refresh replay used the stored `room` property, while the server join contract requires `code`. Sessions now store `code` and continue accepting legacy `room` values.
- The homepage image was under-resolution and visibly soft. It has been replaced by a 1200 × 1200 self-produced original WebP.
- Portrait battlefield height and camera-control grid were audited and adjusted for usable play space without reducing primary touch targets below 40 px.

## Error audit

The final UX, 3D, world, and two-browser runs recorded no application console errors, page exceptions, or failed asset requests.
