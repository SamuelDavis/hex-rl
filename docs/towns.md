# Towns

Contract for townsfolk, factions, interaction, trade and bounties. Data in `src/game/content/creatures.ts` and `content/factions.ts`, rules in `src/game/actions/towns.ts` and `src/game/quests.ts`, tests in `src/game/towns.test.ts`.

## Vocabulary

| Term | Meaning | In code |
|---|---|---|
| Faction | Side an entity fights for; `relationOf` says who are foes. The player is `town`; a creature takes its home spawner's. | `allegiance` component, `FACTIONS`, `relationOf` |
| Lair | Wild spawner: weighted `pool` up to `cap`, `boss` when wrecked. | `Lair` |
| Town | Town spawner: spawns the first `roster` kind with fewer than its count alive, so a slain bailiff returns first, then the reeve, then peasants. Not attackable. | `Town` |
| Townsfolk | Monsters from a town (`bailiff`, `reeve`, `peasant`). Same Minds, leash and rules as wild monsters. | `CREATURES` |
| Service | What interacting with a kind does: `trade` (reeve) or `bounty` (bailiff). No service: `uninterested`. | `SERVICES` |
| Wares, purse | A trader's items and gold. | `wares`, `purse` components |
| Bounty | A lair whose boss to slay, its level, whether slain. | `Bounty`, `questing` component |

## Siting

- Towns are a `HABITAT` kind in `src/game/terrain.ts` like any spawner (biome weights, a bonus near fresh water), and `isSettler`: only sited where every hex within `TOWN_CLEARING` is dry and within `TOWN_RELIEF` blocks of the center.
- The `settledAt` stage levels each town's clearing to its ground and clears its trees; where clearings meet, the nearest town wins. `tileAt` reads it; spawner siting and the spawn point read the unsettled `chunkAt`, so settling can't feed back into them.
- A town takes its biome's identity: townsfolk are named for it (`creatureNameOf`, "coastal reeve", `src/Pages/Game/narration.ts`) and themes draw the same town sprite in biome colors (`CanvasTheme.spawner` receives the biome).

## Rules

- Minds notice the nearest foe (`mindOf`): any hostile entity with hit points, spawners included, but foes that can fight back (with `stats`) before spawners. So townsfolk and wild monsters hunt each other and, with no fighter in sight, each other's spawners; nobody attacks its own faction's. Townsfolk never target the player. A wrecked spawner without a boss (a town) just heals and spawns again. Kills by townsfolk grant the player nothing.
- Idle townsfolk beside the player wait (`isAttending`), so trading isn't interrupted by wandering.
- The player's damage (bump, spells) only hurts foes.
- `interact` (player-only, adjacent, facing irrelevant) spends a turn only when the creature has a Service. The player's `move` policy is `courteous`: `bold`, but an `attack` rejected as `friendly` falls back to `interact`.
- `trade` (player-only, adjacent reeve): a pack item sells for `offerOf`, paid from the reeve's purse, and joins the wares; a ware buys for `priceOf`, into the purse, if gold and pack room suffice. Each spends a turn.
- `restock` (the reeve's knack, `ABILITIES.restock`, triggered while idle): when ready, tops wares up to `stock` with fresh `waresOf` and gold up to `gold`, then cools down for a random turn count in `cooldown`. Attempted first in the reeve's Plan, falling back to its move when `full`.
- Bounties: interacting with any bailiff pays a slain bounty (`BOUNTY_GOLD_PER_LEVEL` × its level, recorded as `bountyLevel`), then, if none is outstanding, posts the nearest lair to the bailiff whose `dangerOf` exceeds `bountyLevel` (searched in widening `BOUNTY_SEARCH` rings). Only the player slaying that lair's boss fulfils it.

## UI

- `interact` is a remappable control that acts at once on the target, like a creature-aimed spell (strike); with no adjacent target it is rejected.
- Whoever the player tries to interact with, by bump or button, becomes the target, even if uninterested (`addresseeOf`, `src/Pages/Game/session.ts`).
- The outstanding bounty's lair is marked on the map above the fog of war (`CanvasTheme.bounty`).
- `Session.conversant` opens the creature's dialog (trade or bounty) while it stays adjacent (`conversantOf`); dismissing or stepping closes it.
