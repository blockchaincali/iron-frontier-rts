# IRON FRONTIER — Real-time Strategy Game

An original browser RTS separate from NEON HEIST. Build armies, capture relays, command units, launch orbital strikes and defeat an AI opponent or a human rival in a private 1v1 room.

## Quick start

```bash
npm install
npm start
```

The checked-in JavaScript, styles, tests and assets are the authoritative source. `npm start` launches `server.js` directly; startup never generates or rewrites repository files.

Run the complete test suite with:

```bash
npm test
```

- WebSocket multiplayer server
- Tactical game simulation in `src/engine.js`
- Desktop/mobile client in `public/`
- AI opponent, unit building, 3 capture points and orbital artillery
- Coastal, desert and frozen 3D battlegrounds with a tactical 2D fallback
- Operation Safe Haven, a solo civilian-defense mission with engineer construction, functional defenses, protected patrol production, community facilities, and staged evacuation objectives
- Automated tests, original artwork and architecture documentation

## Beginner controls

- Tap or click a cyan unit to select it, then tap terrain to move or a red target to attack.
- `Select All` is always available; desktop shortcuts are `1–3` to recruit, `Q` select all, `M` move, `A` attack-move, `H` hold, and `B` orbital strike.
- Choose **Guided Tutorial** from the home screen, or use the in-battle `?` button to replay it.
- Switch between the Three.js battlefield and the 2D tactical map at any time.

## Operation Safe Haven

Choose **Operation Safe Haven** on the home screen to play the focused civilian-defense mission. Select the engineer, choose a structure, and tap or click clear ground to preview and confirm placement. Barricades block attackers, watchtowers engage them, field clinics heal nearby units, and workshops produce protected patrol vehicles. Preparation is protected until the required defenses are ready or training is explicitly skipped.

Run its browser interaction and performance check with `npm run qa:safe-haven` while the local server is running. Mission details and measured limitations are documented in `docs/SAFE_HAVEN_MISSION.md`.

The current build includes a Three.js battlefield and a fully playable 2D tactical fallback. Run one instance on Render because active room state is held in memory.

Additional browser validation commands are `npm run qa:ux`, `npm run qa:3d`, `npm run qa:world`, and `npm run qa:final`. Start the local server first and set `IRON_FRONTIER_URL` when it is not running at the script default.
