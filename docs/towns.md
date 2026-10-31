# Towns

Contract for townsfolk, factions, interaction, trade, bounties, settlement growth and the ground it reshapes. Data in `src/game/content/creatures.ts`, `content/factions.ts` and `content/settlements.ts`, rules in `src/game/actions/towns.ts`, `src/game/quests.ts` and `src/game/settlements.ts`, tests in `src/game/towns.test.ts` and `src/game/settlements.test.ts`.

## Vocabulary

| Term | Meaning | In code |
|---|---|---|
| Faction | Side an entity fights for; `relationOf` says who are foes. The player is `town`; a creature takes its home spawner's. | `allegiance` component, `FACTIONS`, `relationOf` |
| Spawner strategy | How a spawner recruits (`pool`: weighted draws up to `cap`; `roster`: the first kind below its count) and when its `boss` appears (`wrecked`, or `always` kept alive, before any recruit). At most one boss is alive per spawner. | `SpawnerType`, `Recruiting`, `Boss` |
| Lair | Wild spawner: a `pool`, its boss once `wrecked`. | `SPAWNERS` |
| Town | Town spawner: its boss, the bailiff, `always` kept alive and so returned first, at once; then its `roster`, the reeve, then peasants. Wild monsters may wreck it; the player can't attack it. | `SPAWNERS.town` |
| Settlement | A town, keep or castle: a town spawner that grows. Its `townLevel` sets its tier; its boss is its highest rank (bailiff, baron, duke), lower ranks join its roster, one of each. | `settlement` component, `TIERS` |
| Outpost | A town spawner a settlement founds nearby (gold mine, sawmill, barracks, smithy, stables, farm, docks, bazaar), each keeping its own boss and workers. | `fealty` component (`liege`), `OUTPOSTS` |
| Townsfolk | Monsters from a town spawner (`bailiff`, `reeve`, `peasant`, nobles, outposts' folk). Same Minds, leash and rules as wild monsters. | `CREATURES` |
| Service | What interacting with a kind does: `trade` (reeve) or `bounty` (bailiff). No service: `uninterested`. | `SERVICES` |
| Wares, purse | A trader's items and gold. | `wares`, `purse` components |
| Bounty | A lair whose boss to slay, its level, whether slain. | `Bounty`, `questing` component |

## Siting

- Towns are a `HABITAT` kind in `src/game/terrain.ts` like any spawner (biome weights, a bonus near fresh water), and `isSettler`: only sited where every hex within `TOWN_CLEARING` is dry and within `TOWN_RELIEF` blocks of the center.
- The `settledAt` stage levels each town's clearing to its ground and clears its trees; where clearings meet, the nearest town wins. `tileAt` reads it; spawner siting and the spawn point read the unsettled `chunkAt`, so settling can't feed back into them.
- A town takes its biome's identity: townsfolk are named for it (`creatureNameOf`, "coastal reeve", `src/Pages/Game/narration.ts`) and themes draw the same town sprite in biome colors (`CanvasTheme.spawner` receives the biome).

## Rules

- Minds notice the nearest foe (`mindOf`): any hostile entity with hit points, spawners included, but foes that can fight back (with `stats`) before spawners. So townsfolk and wild monsters hunt each other and, with no fighter in sight, each other's spawners; nobody attacks its own faction's. Townsfolk never target the player. Kills by townsfolk grant the player nothing.
- Idle townsfolk beside the player wait (`isAttending`), so trading isn't interrupted by wandering.
- The player's damage (bump, spells) only hurts foes.
- `interact` (player-only, adjacent, facing irrelevant) spends a turn only when the creature has a Service. The player's `move` policy is `courteous`: `bold`, but an `attack` rejected as `friendly` falls back to `interact`.
- `trade` (player-only, adjacent reeve): a pack item sells for `offerOf`, paid from the reeve's purse, and joins the wares; a ware buys for `priceOf`, into the purse, if gold and pack room suffice. Each spends a turn.
- `restock` (the reeve's knack, `ABILITIES.restock`, triggered while idle): when ready, tops wares up to `stock` with fresh `waresOf` and gold up to `gold`, then cools down for a random turn count in `cooldown`. Attempted first in the reeve's Plan, falling back to its move when `full`.
- Bounties: interacting with any bailiff pays a slain bounty (`BOUNTY_GOLD_PER_LEVEL` × its level, recorded as `bountyLevel`), then, if none is outstanding, posts the nearest lair to the bailiff whose `dangerOf` exceeds `bountyLevel` (searched in widening `BOUNTY_SEARCH` rings). Only the player slaying that lair's boss fulfils it.

## Growth

- Paying a bounty grows the paying bailiff's home settlement (`grown`): one `townLevel` (`grew`), then one outpost (`founded`), then its tier (`rose`). A bailiff whose home isn't a settlement in play grows nothing.
- Outposts: one per level, of a kind it lacks and whose `needs` tier it has reached (barracks and stables a keep), on a free, dry, treeless hex within `OUTPOST_REACH`, not beside its settlement or any spawner, where its `suits` test passes on the site or a neighbour (docks by water, gold mine by mountains, sawmill by trees, bazaar by desert, stables and farm on plains; barracks and smithy anywhere). Kind and site are seeded by the settlement's hex and level. No suitable site, no outpost. Founding before rising means a town founds once before it is a keep.
- Tiers (`TIERS`: keep at level 2, castle at 4): the spawner's kind changes, its hit points rise by the difference, its folk are rehomed to the new kind, and its new boss emerges on its next turn.
- Barons, dukes and outposts' folk offer no Service yet.

## Ground

Settlements reshape the land as they grow, so a settlement and its outposts read as one place (`reshaped`, `src/game/settlements.ts`):

- Every clearing levels the ground within its radius (`clearingOf`: outpost 1, town 2, keep 3, castle 4) to its settlement's ground and clears trees; the `SMOOTHING` band (2 hexes) beyond eases ground linearly back to the land's. Where clearings overlap, the one whose edge is nearest wins. Water is never touched.
- Reshaped tiles live in `Game.altered`, over the land; everything reads tiles through `tileAt(game, hex)` / `tilesOf(game)`, never `land.tileAt`. They are recomputed around a settlement when it materialises or rises, and around an outpost when founded.
- Terrain's `settledAt` still levels each town's `TOWN_CLEARING` so siting and the spawn point stay pure; the reshape on materialising adds its smoothing.

## UI

- `interact` is a remappable control that acts at once on the target, like a creature-aimed spell (strike); with no adjacent target it is rejected.
- Whoever the player tries to interact with, by bump or button, becomes the target, even if uninterested (`addresseeOf`, `src/Pages/Game/session.ts`).
- The outstanding bounty's lair is marked on the map above the fog of war (`CanvasTheme.bounty`).
- `Session.conversant` opens the creature's dialog (trade or bounty) while it stays adjacent (`conversantOf`); dismissing or stepping closes it.
