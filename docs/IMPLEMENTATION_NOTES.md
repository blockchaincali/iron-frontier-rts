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
