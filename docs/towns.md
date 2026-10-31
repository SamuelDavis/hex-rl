# Towns

Contract for townsfolk, factions, interaction, trade and bounties. Data in `src/game/creatures.ts`, rules in `src/game/game.ts`, tests in `src/game/towns.test.ts`.

## Vocabulary

| Term | Meaning | In code |
|---|---|---|
| Faction | Side an actor fights for. Actors of different factions are foes; the player is `town`. A monster's faction is its home spawner's. | `Faction`, `factionOfCreature` |
| Lair | Wild spawner: weighted `pool` up to `cap`, `boss` when wrecked. | `Lair` |
| Town | Town spawner: spawns the first `roster` kind with fewer than its count alive, so a slain bailiff returns first, then the reeve, then peasants. Not attackable. | `Town` |
| Townsfolk | Monsters from a town (`bailiff`, `reeve`, `peasant`). Same Minds, leash and rules as wild monsters. | `CREATURES` |
| Service | What interacting with a kind does: `trade` (reeve) or `bounty` (bailiff). No service: `uninterested`. | `SERVICES` |
| Wares | A trader's items, on the creature; lost when it is forgotten. | `Creature.wares` |
| Bounty | Player state: a lair whose boss to slay, its level, whether slain. | `Bounty`, `Player.bounty` |

## Rules

- Minds notice the nearest foe (`mindOf`), so townsfolk and wild monsters hunt each other; townsfolk never target the player. Kills by townsfolk grant the player nothing.
- Idle townsfolk beside the player wait (`isAttending`), so trading isn't interrupted by wandering.
- The player's damage (bump, spells) only hurts foes.
- `interact` (player-only, adjacent, facing irrelevant) spends a turn only when the creature has a Service. The player's `move` policy is `courteous`: `bold`, but an `attack` rejected as `friendly` falls back to `interact`.
- `trade` (player-only, adjacent reeve): a pack item sells for `offerOf` and joins the wares; a ware buys for `priceOf` if gold and pack room suffice. Each spends a turn. The reeve has unlimited gold.
- `restock` (monster-only, `CREATURE_SPELLS.reeve`): while idle and ready, tops wares up to `stock` with fresh `waresOf`, then cools down for a random turn count in `cooldown`. Attempted first in the reeve's Plan, falling back to its move when `full`.
- Bounties: interacting with any bailiff pays a slain bounty (`BOUNTY_GOLD_PER_LEVEL` × its level, recorded as `bountyLevel`), then, if none is outstanding, posts the nearest lair to the bailiff whose `dangerOf` exceeds `bountyLevel` (searched in widening `BOUNTY_SEARCH` rings). Only the player slaying that lair's boss fulfils it.

## UI

- `interact` is a remappable control that aims like a hex spell (`Aimed`, `INTERACT_RANGE` in `src/Pages/Game/mode.ts`), starting on the target if adjacent.
- Whoever the player tries to interact with, by bump or button, becomes the target, even if uninterested (`addresseeOf`, `src/Pages/Game/session.ts`).
- `Session.conversant` opens the creature's dialog (trade or bounty) while it stays adjacent (`conversantOf`); dismissing or stepping closes it.
