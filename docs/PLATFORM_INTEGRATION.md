# Platform integration (Vatar / Lagos Life readiness)

HOMESTAND runs as a standalone web game. Any partner integration must be designed **after** reviewing the partner's official SDK and requirements; nothing in this repository calls or imitates a partner API, account system or payment flow.

## Seam: `window.HomestandPlatform` (`public/platform.js`)

`platform.js` loads before `game.js`. A partner shell may define `window.HomestandPlatform` first; the standalone adapter then steps aside.

| Member | Standalone behaviour | Partner adaptation point |
| --- | --- | --- |
| `id` | `'standalone'` | Partner identifier |
| `player()` | Name from local storage, `verified:false` | Display name from a verified partner session |
| `emit(event, detail)` / `on(event, fn)` | Local event bus | Forward to partner analytics or lifecycle hooks |
| `capabilities` | `accounts:false, purchases:false, leaderboards:false` | Declare only what the partner actually provides |

Events emitted by the game today: `launch` (`mode`, `missionId`, `difficulty`), `battle-start` (`mission`, `mapId`), `battle-end` (`won`, `mission`, `stars`).

## Constraints that must hold for any integration

- Gameplay stays server-authoritative (`server.js`, `src/engine.js`); the platform layer never changes outcomes.
- No pay-to-win: there is no currency, store or purchasable advantage, and none should be added through this seam.
- The standalone Railway build keeps working without any partner script.
- Embedding: the game is a single page with a fixed, scroll-free battle layout, safe-area aware, and tolerates fullscreen/orientation APIs being unavailable — suitable for a webview.

## Open questions for the partner review

Authentication handoff format, webview capabilities (fullscreen, orientation lock, audio policy — sound starts only after a user gesture), content-rating requirements for a civilian-defense theme set in real Nigerian cities with IED mechanics (guardrails in `DEFEND_THE_NORTH.md`), analytics schema, and whether multiplayer rooms may be shared through partner social features.
