# Architecture

Contract for how game state, behaviour and content are organised in `src/game/`: an ECS *type system* (components, entities, systems) over a pure, deterministic reducer. Not ECS storage: entity counts are small and turns serial, so memory layout buys nothing. Supersedes the ECS rejection in [action-pipeline.md](action-pipeline.md); the action pipeline itself stands. Time drivers (clock, input buffers) are [time.md](time.md).

## Goals

- One implementation per concept: health, position, conditions, faction, acting. Anything with health is damaged, killed or wrecked by the same code (`health.ts`), whatever it is.
- Engine vs content: engine code speaks only abstract terms (Entity, Condition, Faction, Ability, Effect). Aesthetic terms (wolf, bleed, bailiff, town) appear only in `content/`, `archetypes.ts` and narration. Engine code never branches on a kind or an id.
- Extension by data first, by a new system second, by a new primitive last ([Recipes](#recipes)).
- Multiplayer-ready: plain serialisable state, deterministic ticks, no singleton player in the engine.

## Vocabulary

| Term | Meaning | In code |
|---|---|---|
| Component | One concern's data: a small interface of flat fields. | `components.ts`, `Components` |
| Entity | An id, a kind, a spawn `seq`, and any subset of components' fields. Plain data, never a class. | `Entity`, `With<K>`, `has` |
| Archetype | Which components a kind of entity is built with. The only place content becomes entities. | `archetypes.ts` |
| Game | Entities in spawn order, an occupancy index, chests, seen hexes, turn, events. | `Game`, `world.ts` |
| System | Pure `(game) => game` over entities with given components; one concern, one module. | `systems/`, `UPKEEP` |
| Agent | An entity that takes turns: a `seat` (a human's, given Intents) or a `mind` (chooses its own). | `Agent.controller` |
| Intent / Deed / Rule / Plan | As in [action-pipeline.md](action-pipeline.md), for any entity with `agent`. | `actions/` |
| Effect | Closed set of primitive state changes, one applier. Abilities and conditions compose them. | `effects.ts` |
| Ability | Data row: costs, cooldown, aim, effects, and for creatures' knacks a `trigger`. | `content/abilities.ts` |
| Condition | Timed or permanent state on an entity: gates Deeds, applies Effects every so many turns. | `conditions.ts`, `content/conditions.ts` |
| Faction | Allegiance; `relationOf` is the only hostility check. | `content/factions.ts` |
| Event | Authoritative record of one consequence: `source`, `target`, `cause`. | `events.ts` |
| Tick | One world turn: every active agent acts once, in spawn order, then upkeep. | `tick.ts` |
| Active chunk | A chunk near a seat; only its entities are processed. | `systems/chunks.ts` |

## Components

Each component is an interface of flat fields in `components.ts`, named in the `Components` registry. `Entity` is `Identity & Partial<Fields>`, derived from the registry, never hand-listed; `With<"health" | "position">` requires those components; `has(entity, ...names)` narrows by each component's marker field. Field names are unique across components (`readyAt` for abilities, `spawnsAt` for spawning).

| Component | Fields | Has it |
|---|---|---|
| position | `at`, `facing` | everything placed |
| health | `hp`, `maxHp`, `onDepleted` (`perish` / `fall` / `wreck`) | player, creatures, spawners |
| mana | `mp`, `maxMp` | player |
| conditions | `conditions` | player, creatures, spawners |
| allegiance | `faction` | player, creatures, spawners |
| agent | `controller` (`seat` / `mind`) | player, creatures |
| mind | `mind` (`mind.ts` state machine) | creatures |
| membership | `home` (spawner) | creatures |
| caster | `abilities` (known, with level), `readyAt` | player, creatures |
| stats | `damage`, `power` | player, creatures |
| inventory | `pack`, `equipment` | player |
| purse | `gold` | player, traders |
| wares | `wares` | traders |
| progression | `xp`, `kills` | player |
| questing | `bounty`, `bountyLevel` | player |
| spawning | `spawnsAt`, `isWrecked`, `isBossDue` | spawners |

- Rules and systems state what they need with `With<...>` and narrow with `has`; a Rule whose actor lacks a component rejects `unable`.
- Any entity may carry any component: spawners have `health` and `conditions`, so a burning condition would burn a camp with no new code.
- The UI reaches the local seat through `playerOf`; the engine does only in `isOver`, `vision` and the turn-based `act`.

## Systems

| System | Module | Does |
|---|---|---|
| agents | `systems/agents.ts` | the turn loop ([Ticks](#ticks)) |
| minds | `systems/minds.ts` | a mind's perception (`mindOf`) and Plan (`planFor`): its move, preceded by a knack its state triggers |
| conditions | `systems/conditions.ts` | each bearer's due `every` effects, credited to whoever inflicted them, then recovery |
| chunks | `systems/chunks.ts` | the active set; materialises spawners of newly active chunks |
| spawning | `systems/spawning.ts` | spawns members, revives healed wrecks, unleashes bosses |
| vision | `systems/vision.ts` | the player's seen hexes |

`UPKEEP` (`tick.ts`) is the single ordered list of per-tick systems after the agents: conditions, chunks + spawning, vision. Each stamps its events' `cause`.

## Chunks

The world is infinite and chunked on the terrain grid (`CHUNK` in `terrain.ts`), simplified from Minecraft's load levels to two:

- **Active**: every chunk within `SIMULATION_RADIUS` (2: a 5×5 block) of a seat's. Entities here act, suffer conditions and spawn. `SIMULATION_RADIUS × CHUNK` spans more than `SIGHT`, so nothing a seat sees is frozen.
- **Inactive**: everything else. Entities persist, unprocessed and frozen in time.
- All state persists; if that grows too large, persistence becomes selective per kind.
- Spawners are *derived* entities: identity (`spawner:<hexKey>`) and base components come from `Land` (seed, hex). `materialised` adds them the first time their chunk is active; from then on they are ordinary entities.

## Ticks

```
tick(game, intents: ReadonlyMap<EntityId, Intent>) → game
  agents:  each active, standing agent in spawn order: a seat's Intent from `intents` (absent: pass), a mind's own
  upkeep:  UPKEEP, in order
  turn + 1
act(game, intent) → game    // turn-based driver for the local seat: a free Deed or rejection resolves at once; a turn-spending one runs `tick`
```

- **Order is spawn order.** `inserted` stamps a monotonic `seq`; `Game.entities` is an insertion-ordered `Map`. A seat joining is another insertion.
- **The loop walks a cursor, not a snapshot.** `nextAgent` finds the first standing, active agent with a `seq` above the last one resolved, re-reading the current state each step. A slain entity is never reached; one spawned this tick has a `seq` above the tick's starting maximum and first acts next tick.
- **Each agent decides at its own slot**, from the state as it is then; Rules re-validate, so stale Intents are safe.
- **A condition lasts from the next turn**: inflicted on turn `t` for `n` turns, it is current on turns `t+1 … t+n`, so it reaches the bearer's next `n` turns whoever acts first. Its `every` effects fall due on each `interval`-th turn suffered.
- **Multi-turn actions are conditions**: a channel gates other Deeds and applies its Effect when due; cancelling removes it. No action scheduler.
- Randomness is `rngOf(seed, purpose).child(id)` keyed by turn, never by call order.

## Effects

One closed union, one applier `applied(game, effect, { source, origin, at, mastery })`: `face`, `damage(area)`, `restore`, `condition(area)`, `summon`, `restock`. Areas (`self`, `target`, `ahead`, `flanks`, `ring`) are measured from `origin`; `source` is credited. `problemOf` says why an effect would do nothing (`blocked`, `full`, `unable`), so a Plan can fall back. Amounts, counts and turns scale by `mastery` (an ability's level), rounded down.

## Abilities

One table, `ABILITIES`, for the player's spells, potions and creatures' knacks. `use` (any caster) checks readiness (`unreadinessOf`: known, cooled down, mana, potion), aim and effect problems, pays costs and applies effects. A knack's `trigger` makes it self-triggering at its `chance` when ready: `hostile` / `idle` (attempted first in a mind's Plan, falling back to its move) or `hit` (cast on the target of a landed attack, `onHit`). A creature knows its kind's `KNACKS` at its level.

## Conditions

Rows in `content/conditions.ts` typed by `ConditionType` (`conditions.ts`): `allows` / `forbids` gate Deeds, `shakeOff` grows the per-turn recovery chance, `every` applies effects. Inflicted ones (bleed, stun, paralysis) wear off; permanent ones (vigor, focus, mending: regeneration) never do.

- A gated Deed is checked after its Rule's own checks (so a paralysed bump still attacks) and costs the turn struggling (`struggled`).
- `source` on a condition is who applied it: a bleed's damage, and a kill by it, are the bandit's.

## Events

Every event has `source` (an entity snapshot, `Who`), `target` where it has one, and `cause` (`deed`, `ability`, `condition` or `system`), stamped by `caused` around whatever produced it. Narration (`Pages/Game/narration.ts`) is the only place events become prose; a condition-caused `hurt` reads as the condition ("The adventurer bleeds.").

## Layout

```
src/game/
  game.ts         public interface for the UI
  components.ts   registry, Entity, With, has
  world.ts        Game, entity insert/update/remove, occupancy, whoIs, caused
  archetypes.ts   entities built from content
  events.ts       GameEvent, Who, Cause
  effects.ts      Effect, applied, problemOf
  conditions.ts   ConditionType and pure condition logic
  health.ts       damage, depletion, loot
  progression.ts  levels, mastery, kill credit
  quests.ts       bounties
  chests.ts       ground chests
  tick.ts         tick, act, newGame, UPKEEP
  actions/        Deeds, Rules, Plans (one module per Rule family), pipeline
  systems/        one module per system
  content/        abilities, conditions, creatures, factions: aesthetic terms
  hex.ts sight.ts terrain.ts mind.ts items.ts explorer.ts   pure helpers
```

## Recipes

| To add | Do | Not |
|---|---|---|
| Status effect (heal-over-time, burning, countdown) | Row in `CONDITIONS` | Branch in a Rule or system |
| Spell, potion, creature knack | Row in `ABILITIES` composing Effects; a knack also in `KNACKS` | Per-ability function |
| Creature, NPC, spawner kind | Rows in `content/creatures.ts`; components in `archetypes.ts` | New entity type |
| Faction | Row in `FACTIONS` | Comparing factions directly |
| Attribute | Field in a component (e.g. `Stats`) and its archetypes; read where used | Reading it off a kind's table |
| Per-tick world behaviour | Module in `systems/`, entry in `UPKEEP` | Logic in `tick` |
| Action | `Deed` member and its Rule (mapped types force narration) | Special case in `settled` |
| Multi-turn action | Condition gating Deeds, its effect `every` its duration | A scheduler |
| Concern shared by several kinds | Component | Optional fields on an existing one |

## Multiplayer

Long-term goal: a peer-to-peer, host-authoritative, simplified MMO. Nothing is built for it; the design keeps it open.

- Terrain is never synced: every peer regenerates it from `(seed, coordinates)` (procgen's contract). Only entities and events cross the wire.
- The host runs `tick` with each seat's Intents ([time.md](time.md)); peers receive the events they can perceive.
- State is plain data (Maps need a codec) and the reducer pure and seeded, so the host can migrate by sending the state.
- Still single-seat: `playerOf`, `isOver`, `vision` and `act` assume the `PLAYER` seat; making them per seat is the multiplayer change.

## Deferred

- Quests are a `questing` component, not conditions with data and reactions: no second quest exists to justify the generality.
- Stats are base values only; condition and equipment modifiers wait for the first one.
- Spawning is a system, not an Ability: lair rosters, caps, boss and revival don't reduce to the summon effect yet.

## Prior art

- **ECS** (Bevy, Adam Martin): components as the unit of data, systems as the unit of behaviour, queries by component. Adopted as types; storage rejected. [Bevy-ECS; T-Machine-1]
- **Caves of Qud**: parts (components) on one object type. [Qud-Events]
- **Brogue CE**: one bolt table for wands and monster spells. Source of one `ABILITIES` table for every caster. [Brogue-CE Items.c]
- **Game Programming Patterns, Type Object**: archetypes, abilities and condition types as data rows. [GPP-TypeObject]
- **Minecraft**: chunk tickets and load levels around players; entities suspended outside the simulation distance. Simplified to two levels. [Minecraft-Chunk]
- **MMO servers**: every actor in one loop; input acted on at the next tick. Source of the spawn-ordered loop and the Intent map. [Input-Buffer]

Other sources as in [action-pipeline.md](action-pipeline.md#sources).

- Minecraft-Chunk: https://minecraft.wiki/w/Chunk (load levels, tickets, simulation distance)
- Input-Buffer: https://daposto.medium.com/game-networking-6-event-input-command-ring-buffer-priority-queue-4ec1b0d985fc ; https://serverside.com/blog/game-server-latency
