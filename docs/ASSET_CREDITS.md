# Asset credits and provenance

## Milestone 3 runtime art

All 3D unit meshes, structures, terrain dressing, procedural terrain texture, faction materials, selection indicators, projectile trails and combat effects in `public/3d.js` were created specifically for IRON FRONTIER. They are assembled at runtime from reusable Three.js geometry and original parameters. There are no third-party model, texture, animation, particle, or sound downloads in the 3D renderer.

The renderer uses the repository's installed `three` package, served locally as `/vendor/three.module.js`. Three.js is distributed under the MIT License; see the dependency's included license in `node_modules/three/LICENSE` when dependencies are installed.

## Existing project artwork

`public/assets/concept-battle.webp` predates Milestone 3 and is used only on the home screen. Its original provenance should be confirmed by the project owner before public competition submission. It is not loaded by the 3D battlefield.

## Known asset limitation

This milestone intentionally ships original optimized procedural models rather than external GLB files, eliminating network/model-loader failure modes and keeping geometry reusable. The units have articulated runtime motion and recoil, but they are not skinned character rigs. A future asset pass may replace the infantry assemblies with an original, licensed GLB rig only if it preserves the current silhouettes, performance budgets and provenance requirements.
