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
- AI opponent, unit building, 3 capture points and artillery
- Automated tests, original artwork and architecture documentation

The current build includes a Three.js battlefield and a fully playable 2D tactical fallback. Run one instance on Render because active room state is held in memory.
