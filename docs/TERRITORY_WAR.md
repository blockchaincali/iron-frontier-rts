# Territory War (Milestone 1)

Asymmetrical RTS mode: **Community Defence** (team 0, west) against the fictional **Black Harmattan Raiders** (team 1, east), with the community's town and two outposts between them. Choose it from **Missions → Territory War**: pick a side, a 5-minute (recommended) or 3-minute preparation and an AI difficulty, then **Play vs AI** or **Host vs friend**. The city skin follows the campaign city selected on the map.

## Map (`public/maps.js` → `layouts.frontier`)

| Area | Contents |
|---|---|
| Defence territory (x 125–650) | Command HQ, 10 construction plots, home resource site (Brick kiln) |
| Raider territory (x 1750–2275) | Raider camp HQ, 10 plots, home resource site (Sand pit) |
| Town (x 700–1080) | Clinic, school, market and community centre, homes, market stalls |
| Outposts | North (Tudun Wada) and South (Rafin Gari), exposed to raids |
| Contested ground | North, Central and South checkpoints; two neutral resource sites; four forward plots |
| Routes | North road, central highway, south road; all reach both HQs — no invisible walls |

## Phases

1. **Prepare** (5:00 or 3:00): ceasefire. Build, train, capture neutral checkpoints and stage at the border. Units cannot cross into enemy territory, and no damage is dealt. *Ready* (solo) or both commanders ready (PvP) jumps straight to the warning — never to combat.
2. **Threat warning** (2:00): still a ceasefire. The AI attacker commits to a route; defenders get an intelligence estimate (Easy: confirmed, Standard: ~75% reliable, Veteran: unknown). Solo players may start early; multiplayer cannot skip it.
3. **Live** (20:00): full combat, invasion of either territory, orbital strikes, IEDs. Score: +1/s per checkpoint held, +40 per enemy structure destroyed, +120 to raiders per civilian site destroyed. First to 1,500 or destroying the enemy HQ wins; otherwise the higher score at the time limit.

Safe Haven uses the same timing: 5:00 preparation (3:00 configurable on the server), then a 2:00 warning before the first wave.

## Construction (`public/catalog.js`)

- Every faction starts with a deployed HQ, **two engineers** and three rifle squads. The HQ trains more engineers (120 CR, 6 s).
- Tap **Build**, pick a category tab (Command / Defence / Production) and a structure. Large buildings snap to your highlighted plots; small defences go anywhere in your **build area**: your territory, within 260 px of a checkpoint you hold, or within 200 px of your completed forward structures.
- The nearest free engineer is assigned automatically; select engineers first to choose them. Engineers build different projects in parallel. Tap one of your unfinished buildings with engineers selected to **assist**: rate = Σ 0.65ⁱ (1×, 1.65×, 2.07×, 2.35× cap at four).

| Category | Structures (raider name) | Notes |
|---|---|---|
| Command | Supply Depot (Supply Cache), Resource Collector (Scavenger Yard), Communications Centre (Radio Shack) | Depot +15 army cap (base 20, max 60); collector +6 CR/s on resource sites only; comms requires Barracks, adds energy and unlocks armour |
| Defence | Barricade, Guard Post (Lookout Post), Watchtower (Sniper Nest), Bunker (Dugout), Weapon Emplacement (Gun Pit), Civilian Shelter (defence only), Field Clinic (Aid Tent) | Bunker needs Barracks; emplacement needs Comms |
| Production | Barracks (Training Camp) → infantry; Vehicle Workshop (Technical Yard) → patrol vehicles, scanners; Armoured Vehicle Factory (Heavy Garage) → tanks, rocket batteries | Workshop needs Barracks; factory needs Workshop + Comms |

Direct recruiting from the HQ is closed in this mode: units come from production buildings.

## AI (`src/ai.js`)

One `FactionAI` plays either side with the human rules (plots, tech, costs, supply, ceasefire).

| | Easy | Standard | Veteran |
|---|---|---|---|
| Engineers / parallel builds | 2 / 1 | 3 / 2 | 4 / 3 + assisting |
| First assault after ceasefire | ~110 s, 6 supply | ~45 s, 12 supply | ~12 s, 18 supply |
| Route | Always central, announced | Random, announced | Least-defended, split flank, silent |
| Other | No repairs | Repairs, occasional IEDs | Repairs, IEDs, scanners clear charges |

PvP matches never use AI or difficulty scaling.

## Server and security

`create` validates scenario, faction, prep length (3/5), difficulty and city; the guest of a private room takes the free faction. New `assist` action. Every construction, production, command and strike is validated server-side against faction, plot ownership, build area, tech and ceasefire. Each player only receives their own faction's private events (production, construction) and their own and detected IEDs.

## Tests

`test/territory.test.js` (14 tests) and new cases in `test/rooms.test.js` cover starting state, layout, phase timing, ready-up rules, ceasefire, invasion, plots and tech, build areas, parallel and assisted construction, HQ and building production, supply, raider naming and economy, scoring and rematch, AI legality and difficulty differences, room faction assignment and reconnect.
