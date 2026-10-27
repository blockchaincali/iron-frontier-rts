# Operation Safe Haven

Operation Safe Haven is a self-contained civilian-defense mission set in a fictional Nigerian town. It does not depict a real attack, armed group, town, or military operation. The player commands a community protection and emergency-response force defending residents from a fictional insurgent force.

## Mission flow

1. **Prepare defenses** — a protected training phase gives the player an engineer, four response squads, resources, and unlimited time to place a barricade, watchtower, field clinic, and vehicle workshop. Hostile attacks, capture pressure, and the match timer remain paused until preparation is completed or explicitly skipped.
2. **Protect community facilities** — defend Amina Community Clinic, Unity Market, and Safe Haven Centre through a timed series of balanced attacks. At least two facilities must survive.
3. **Secure the evacuation route** — hold the eastern evacuation point long enough to establish a safe corridor.
4. **Survive the final assault** — withstand the last coordinated wave while keeping the town's headquarters and at least two civilian facilities operational.

The mission is won after the final assault. It is lost if the headquarters falls or fewer than two civilian facilities remain.

## Construction and unit controls

- Select the engineer, choose a structure, then tap or click a valid location. A green placement preview confirms clear ground; an invalid preview explains collisions or range limits.
- Barricades block and separate ground forces.
- Watchtowers automatically engage hostiles in range.
- Field clinics heal nearby friendly units.
- Vehicle workshops produce protected patrol vehicles.
- Completed structures can be selected, inspected, and upgraded once. Costs, build time, production queues, health, collision checks, and upgrades are validated by the server simulation.

The mission supports mouse, touch, drag panning, pinch zoom, the existing camera controls, balanced/high renderer tiers, and the 2D tactical fallback. Compact landscape controls keep the battlefield dominant; portrait mode shows a nonblocking rotation suggestion while remaining playable.

## Environment and provenance

The town is an original composite environment rather than a recreation of a specific place. Its residential compounds, market stalls, painted roofs, local road markings, elevated water tanks, clinic, community centre, vegetation, and security infrastructure are code-authored in `public/3d.js`. They reuse the repository's existing local material system and Three.js geometry; the mission introduces no third-party models, textures, logos, runtime downloads, or proprietary reference-game assets.

## Validation snapshot

Validated October 27, 2026 in installed Chromium with real WebGL 2 through ANGLE on Intel UHD Graphics 620:

- All four structures were placed through real pointer input, completed authoritatively, and exercised in combat.
- A patrol vehicle was produced from the workshop and the watchtower was upgraded.
- Desktop sustained combat averaged 51 FPS with a 42 FPS minimum, 373 average/435 maximum draw calls, 83,640 maximum triangles, and an 11 MB JavaScript heap.
- The complete 64-second cold-start-to-combat run averaged 52.4 FPS with a 9.4 FPS 1% low, a 33.6 ms p99 frame time, and one 2,543 ms shader/scene initialization long task.
- Chromium landscape touch emulation at 844 x 390 averaged 54 FPS with a 29 FPS minimum, 244 maximum draw calls, no horizontal overflow, and a 273 px battlefield viewport.

These are measurements from one browser and GPU, not guarantees for every desktop or a physical phone. The cold-start spike remains the primary performance limitation; warmed sustained combat met the 30 FPS goal on the measured integrated GPU.

Evidence is stored in `artifacts/safe-haven/`: homepage, defense, combat, and landscape-mobile screenshots; `operation-safe-haven-demo.webm`; and the machine-readable `report.json`.
