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
| Game | Entities in spawn order, an occupancy index, chests, tiles reshaped in play (`altered`, read via `tileAt`), seen hexes, turn, events. | `Game`, `world.ts` |
| System | Pure function over entities with given components; one concern, one module. Per-entity ones are phases of each entity's turn (`TURN`); world-level ones run after (`UPKEEP`). | `systems/`, `TURN`, `UPKEEP` |
| Agent | An entity that chooses Intents: a `seat` (a human's, given them) or a `mind` (chooses its own by its components: a creature's Mind, a spawner's spawning). | `Agent.controller` |
| Intent / Deed / Rule / Plan | As in [action-pipeline.md](action-pipeline.md), for any entity with `agent`. | `actions/` |
| Effect | Closed set of primitive state changes, one applier. Abilities and conditions compose them. | `effects.ts` |
| Ability | Data row: costs, cooldown, aim, effects, and for creatures' knacks a `trigger`. | `content/abilities.ts` |
| Condition | Timed or permanent state on an entity: gates Deeds, applies Effects every so many turns. | `conditions.ts`, `content/conditions.ts` |
| Faction | Allegiance; `relationOf` is the only hostility check. | `content/factions.ts` |
| Event | Authoritative record of one consequence: `source`, `target`, `cause`. | `events.ts` |
| Tick | One world turn: every active entity takes its turn once, in spawn order, then upkeep. | `tick.ts` |
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
| agent | `controller` (`seat` / `mind`) | player, creatures, spawners |
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
| settlement | `townLevel` | towns, keeps, castles |
| fealty | `liege` (its settlement's hex) | outposts |

- Rules and systems state what they need with `With<...>` and narrow with `has`; a Rule whose actor lacks a component rejects `unable`.
- Any entity may carry any component: spawners have `health` and `conditions`, so a burning condition would burn a camp with no new code.
- The UI reaches the local seat through `playerOf`; the engine does only in `isOver`, `vision` and the turn-based `act`.

## Systems

An entity's turn is `TURN` (`systems/turns.ts`), the single ordered list of per-entity phases; each acts only on entities with the components it needs:

| Phase | Module | Does |
|---|---|---|
| suffering | `systems/conditions.ts` | its conditions suffered a turn longer; due `every` effects applied, credited to whoever inflicted them |
| acting | `systems/turns.ts`, `systems/minds.ts` | an agent's Plan: a seat's given Intent, or a mind's choice (`minded`): a creature's perception (hostile fighters before hostile spawners, nearest first) and move, a spawner's `spawn` (`actions/spawning.ts`, falling back to `wait`) |
| recovering | `systems/conditions.ts` | its timed conditions run down, and may be shaken off |

`UPKEEP` (`tick.ts`) is the single ordered list of world-level systems after every turn: `chunks` (the active set; materialises spawners of newly active chunks), then `vision` (the player's seen hexes). Every phase and system stamps its events' `cause`.

## Chunks

The world is infinite and chunked on the terrain grid (`CHUNK` in `terrain.ts`), simplified from Minecraft's load levels to two:

- **Active**: every chunk within `SIMULATION_RADIUS` (2: a 5×5 block) of a seat's. Entities here act, suffer conditions and spawn. `SIMULATION_RADIUS × CHUNK` spans more than `SIGHT`, so nothing a seat sees is frozen.
- **Inactive**: everything else. Entities persist, unprocessed and frozen in time.
- All state persists; if that grows too large, persistence becomes selective per kind.
- Spawners are terrain props: which exist, and where, is the terrain generator's (`spawnersAt` in `terrain.ts`: habitat, water, `SPAWNER_DENSITY`, distance from spawn), so density is tuned there, not by the active area. They become *derived* entities: identity (`spawner:<hexKey>`) and base components from `Land` (seed, hex); `materialised` adds them the first time their chunk is active; from then on they are ordinary entities.

## Ticks

```
tick(game, intents: ReadonlyMap<EntityId, Intent>) → game
  turns:   each active, standing entity in spawn order takes its TURN; a seat acts on its Intent from `intents` (absent: pass)
  upkeep:  UPKEEP, in order
  turn + 1
immediate(game, intent) → game | undefined   // the player's free Deed or rejection, at once; undefined if it would spend a turn
act(game, intent) → game                     // turn-based: immediate, else the tick it spends
```

What drives ticks (paused, turn-based, ticks per second, input buffer) is host code: [time.md](time.md).

- **Order is spawn order.** `inserted` stamps a monotonic `seq`; `Game.entities` is an insertion-ordered `Map`. A seat joining is another insertion.
- **The loop walks a cursor, not a snapshot.** `nextOf` finds the first standing, active entity with a `seq` above the last one whose turn ran, re-reading the current state each step. A slain entity is never reached; one spawned this tick has a `seq` above the tick's starting maximum and first takes a turn next tick.
- **Each agent decides at its own slot**, from the state as it is then; Rules re-validate, so stale Intents are safe.
- **Every tick, every active entity takes exactly one turn**, so an entity's turns and the world's ticks are the same count; only an entity frozen in an inactive chunk takes none.
- **Conditions take effect on their target's next turn.** Inflicted, a condition is registered on its target at once; its target's next turn may come later in the same tick (if it follows the inflicter in spawn order) or in the next. From then on: its `every` effects at the start of each `interval`-th turn suffered, its gates during the turn, its duration and shake-off at the turn's end.
- **Multi-turn actions are conditions**: a channel gates other Deeds and applies its Effect when due; cancelling removes it. No action scheduler.
- Randomness is `rngOf(seed, purpose).child(id)` keyed by turn, never by call order.

## Effects

One closed union, one applier `applied(game, effect, { source, origin, at, mastery })`: `face`, `damage(area)`, `restore`, `condition(area)`, `summon`, `restock`. Areas (`self`, `target`, `ahead`, `flanks`, `ring`) are measured from `origin`; `source` is credited. `problemOf` says why an effect would do nothing (`blocked`, `full`, `unable`), so a Plan can fall back. Amounts, counts and turns scale by `mastery` (an ability's level), rounded down.

## Abilities

One table, `ABILITIES`, for the player's spells, potions and creatures' knacks. `use` (any caster) checks readiness (`unreadinessOf`: known, cooled down, mana, potion), aim and effect problems, pays costs and applies effects. A knack's `trigger` makes it self-triggering at its `chance` when ready: `hostile` / `idle` (attempted first in a mind's Plan, falling back to its move) or `hit` (cast on the target of a landed attack, `onHit`). A creature knows its kind's `KNACKS` at its level.

## Conditions

Rows in `content/conditions.ts` typed by `ConditionType` (`conditions.ts`): `allows` / `forbids` gate Deeds, `shakeOff` grows the per-turn recovery chance, `every` applies effects. Inflicted ones (bleed, stun, paralysis) wear off; permanent ones never do: `regeneration` restores a hit point every 10 turns (the player, and spawners, a passive, slow heal, wrecked or not), `mana regeneration` a mana point every 2.

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
  settlements.ts  settlement growth: levels, tiers, outposts, reshaped ground
  chests.ts       ground chests
  tick.ts         tick, immediate, act, newGame, UPKEEP
  actions/        Deeds, Rules, Plans (one module per Rule family), pipeline
  systems/        one module per system
  content/        abilities, conditions, creatures, factions, settlements: aesthetic terms
  hex.ts sight.ts terrain.ts mind.ts items.ts explorer.ts   pure helpers
```

## Recipes

| To add | Do | Not |
|---|---|---|
| Status effect (heal-over-time, burning, countdown) | Row in `CONDITIONS` | Branch in a Rule or system |
| Spell, potion, creature knack | Row in `ABILITIES` composing Effects; a knack also in `KNACKS` | Per-ability function |
| Creature, NPC, spawner kind | Rows in `content/creatures.ts`; components in `archetypes.ts` | New entity type |
| Spawning behaviour | A `Recruiting` variant or `Boss.spawns` value (`content/creatures.ts`) and its case in `actions/spawning.ts` | Branching on a spawner's kind or faction |
| Faction | Row in `FACTIONS` | Comparing factions directly |
| Attribute | Field in a component (e.g. `Stats`) and its archetypes; read where used | Reading it off a kind's table |
| Per-entity behaviour each turn | Phase in `systems/`, entry in `TURN` | Logic in `turns` |
| World-level behaviour each tick | Module in `systems/`, entry in `UPKEEP` | Logic in `tick` |
| Action | `Deed` member and its Rule (mapped types force narration) | Special case in `settled` |
| Multi-turn action | Condition gating Deeds, its effect `every` its duration | A scheduler |
| Concern shared by several kinds | Component | Optional fields on an existing one |

## Multiplayer

Long-term goal: a peer-to-peer, host-authoritative, simplified MMO. Nothing is built for it; the design keeps it open.

- Terrain is never synced: every peer regenerates it from `(seed, coordinates)` (procgen's contract). Only entities and events cross the wire.
- The host runs `tick` with each seat's Intents ([time.md](time.md)); peers receive the events they can perceive.
- State is plain data (Maps need a codec) and the reducer pure and seeded, so the host can migrate by sending the state.
- Still single-seat: `playerOf`, `isOver`, `vision`, `immediate` and `act` assume the `PLAYER` seat; making them per seat is the multiplayer change.

## Deferred

- Quests are a `questing` component, not conditions with data and reactions: no second quest exists to justify the generality.
- Stats are base values only; condition and equipment modifiers wait for the first one.
- Spawning is its own Deed, not an Ability: recruiting strategies, bosses and revival don't reduce to the summon effect yet.

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
