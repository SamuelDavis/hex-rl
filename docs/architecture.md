# Architecture

Contract for how game state, behaviour and content are organised: an ECS *type system* (components, entities, systems) over a pure, deterministic reducer. Not ECS storage: entity counts are small and turns serial, so memory layout buys nothing. Supersedes the ECS rejection in [action-pipeline.md](action-pipeline.md); the action pipeline itself stands.

Status: target design. Migration phases at the end; until a phase lands, code may still use the old shape.

## Goals

- One implementation per concept: health, position, conditions, faction, acting. Anything with health is damaged by the same code, whatever it is.
- Engine vs content: engine code (`src/game/` outside `content/`) speaks only abstract terms (Entity, Condition, Faction, Ability, Effect). Aesthetic terms (wolf, bleed, bailiff, town) appear only in content tables and narration.
- Extension by data first, by a new system second, by a new primitive last ([Recipes](#recipes)).
- Multiplayer-ready: plain serialisable state, deterministic ticks, no singleton player.

## Vocabulary

| Term | Meaning | In code |
|---|---|---|
| Component | One concern's data, a small interface. | `Components` registry |
| Entity | An id, an archetype, and any subset of components. Plain data, never a class. | `Entity`, `With<K>` |
| Archetype | Content row an entity is built from: its kind, base components, abilities. Type Object. | `content/archetypes.ts` |
| World | Entities by id, plus world-level state (tick, chests, seen, deltas). | `World` |
| System | Pure `(world) => world` over entities with given components; one concern, one module. | `systems/`, `TICK` |
| Controller | Who chooses an entity's Intents: a player seat or a Mind. | `Agent.controller` |
| Intent / Deed / Rule / Plan | As in [action-pipeline.md](action-pipeline.md), for any entity with `agent`. | `actions/` |
| Effect | Closed set of primitive state changes, one applier. Abilities, conditions, items and quests compose them. | `effects.ts` |
| Condition | Timed or permanent state on an entity: gates Deeds, modifies stats, applies Effects per tick, on expiry, or on Events. | `content/conditions.ts` |
| Stat | Number derived by one function from base, equipment and condition modifiers. | `statOf` |
| Event | Authoritative record of one consequence, with source, target and cause. | `GameEvent` |
| Tick | One world turn: every controller decides, then all Intents resolve. | `tick` |

## Components

Each is an interface in `src/game/components.ts`; the registry maps names to them. `Entity` and `With` are derived from the registry, never hand-listed, so adding a component is one registry entry.

```ts
interface Components {
  position: Position;     // at, facing
  mobility: Mobility;     // may turn/step; spawners lack it
  health: Health;         // hp, max, onDepleted: Effect[] (default: die)
  mana: Mana;
  conditions: Conditions; // ConditionId → { since, until?, source, data? }
  allegiance: Allegiance; // faction: FactionId
  agent: Agent;           // controller: { kind: "seat", seat } | { kind: "mind" }
  mind: Mind;             // policy + state machine (mind.ts)
  caster: Caster;         // abilities known (with level), readyAt per ability
  stats: Stats;           // base attribute values
  inventory: Inventory;   // pack, equipment
  purse: Purse;           // gold
  wares: Wares;           // what it sells
  spawning: Spawning;     // members by archetype, cap, leash
  progression: Progression; // xp, unlocks
}
type Entity = { id: EntityId; archetype: ArchetypeId } & Partial<Components>;
type With<K extends keyof Components> = Entity & Pick<Components, K>;
const has = <K extends keyof Components>(e: Entity, ...k: K[]): e is With<K>;
```

- Systems and Rules declare what they need as `With<...>` and narrow with `has`; never by archetype or id. A Rule whose actor lacks a component rejects `unable`.
- No `player` field: the player is an entity whose controller is a seat. `isOver` is per seat.
- Every entity may carry any component. Spawners have `health` and `conditions`, so fire can burn a camp with no new code.

## Entities

| Archetype family | Components (typical) |
|---|---|
| Player | position, mobility, health, mana, conditions, allegiance, agent(seat), caster, stats, inventory, purse, progression |
| Creature | position, mobility, health, conditions, allegiance, agent(mind), mind, caster, stats; traders add wares, purse |
| Spawner | position, health, conditions, allegiance, agent(mind), mind, caster (its spawn ability), spawning |

- Spawning is an Ability (`summon` an archetype from `spawning.members`), used by the spawner's Mind: dens spawning wolves and wolves summoning cubs are one Deed.
- A wrecked spawner is `health.onDepleted`: apply the `wrecked` condition (gates `use`) and summon the boss. It heals by a regeneration condition; `wrecked` expires when health is full.

### Streaming

The world is infinite; only entities near a seat are live.

- Spawners are *derived* entities: identity (`spawner:<hexKey>`) and base components come from `Land` (seed, hex). Only their divergence from the derived state persists, keyed by hex (today's `SpawnerState`, generalised to a component delta).
- The `streaming` system materialises derived entities entering any seat's active radius (derived + delta) and dematerialises those leaving it (persisting the delta; creatures are dropped, as today).
- Dormant entities are frozen: time does not pass for them.

## Systems

One module per system in `src/game/systems/`; `TICK` (`src/game/tick.ts`) is the single ordered list. A system reads and writes only the components it declares.

| System | Reads | Does |
|---|---|---|
| streaming | position, seats | materialise / dematerialise |
| minds | mind, position, allegiance | update Mind state from perception, choose Intents |
| actions | agent | resolve each Intent through the action pipeline |
| conditions | conditions | per-tick Effects, expiry, shake-off, expiry Effects |
| sight | position (seats) | visible and seen hexes per seat |

Regeneration, spawn timers and cooldowns are conditions or `readyAt` values, not systems.

## Ticks

```
tick(world, intents: Map<EntityId, Intent>) → world
  1. decide:  every agent's Intent, from the same start-of-tick world (seats: given; minds: chosen)
  2. resolve: in a deterministic order, each Intent through the pipeline, its entity looked up live
  3. upkeep:  remaining TICK systems
```

- Decisions are simultaneous; resolution is sequential and deterministic. Resolution iterates the Intent map, not an entity list, and looks each entity up when its turn comes: a dead entity is skipped, a spawned one acts next tick. No loop over a stale snapshot, nothing to crash.
- Rules re-validate at resolution (a foe that moved away makes `attack` reject), so stale decisions are safe.
- The clock is not the game's: `Session` (or a server) calls `tick` on player input (manual) or on a pausable timer (automatic), with whatever Intents seats have queued; a seat with none waits.
- Free Deeds (`spendsTurn: false`: potions, inventory moves) resolve immediately via `act(world, entity, intent)`, outside `tick`.
- Multi-turn actions are conditions: channelling applies a condition that gates other Deeds and applies the Effect on expiry; cancelling removes it (an Event reaction, e.g. on being hit). No action scheduler.
- Randomness is `rngOf(seed, purpose).child(entityId)` keyed by tick, never by call order, so resolution order changes no roll but its own.

## Effects

One closed union, one applier `applied(world, effect, { source, target, cause })`. Every state change from content goes through it, so every change emits its Event with source and cause.

`damage(area, amount)`, `restore(stat, amount)`, `condition(id, turns)`, `cure(id)`, `summon(archetype, count)`, `face`, `grant(gold | item | xp)`.

A new primitive is added only when no composition of these expresses the behaviour.

## Conditions

Data rows in `content/conditions.ts`:

```ts
interface ConditionType {
  allows?: DeedKind[];        // gate: only these (stun: ["wait"])
  forbids?: DeedKind[];       // gate: not these (paralysis: ["turn", "step"])
  shakeOff?: number;          // per-tick growth of recovery chance
  modifiers?: Partial<Stats>;
  every?: { interval: number; effects: Effect[] };  // bleed, regeneration, burning
  onExpire?: Effect[];        // countdowns, channelled actions
  reactions?: { on: EventKind; effects: Effect[]; ends?: boolean }[]; // quests, cancellation
}
```

- A gated Deed is the one rejection that spends a turn (`struggled`), as now.
- `source` on the applied condition is who applied it, so a bleed kill credits the bandit.
- Quests are conditions with `data` (a bounty: target lair, level) and reactions (`killed` matching data → complete).

## Factions

`content/factions.ts`: `FactionId` rows and a relation table (`hostile`, `neutral`, `allied`). `relationOf(a, b)` is the only hostility check. Minds target hostile entities; `attack` rejects non-hostile (`friendly`).

## Stats

`statOf(entity, stat)` = archetype base + `stats` + equipment modifiers + condition modifiers. Damage, max health, regeneration, sight and spell potency read stats through it; nothing reads a raw base value.

## Events

```ts
interface EventBase {
  kind: EventKind;
  tick: number;
  source: Who;              // who or what did it: an entity snapshot
  target?: Who;             // who it was done to
  cause: Cause;             // { deed } | { ability } | { condition } | { system }
}
```

- Every Event has a source, including world-caused ones (a condition's source, or the system).
- Events are the only output; narration (`Pages/Game/narration.ts`) is `(event, viewer) → prose`, so "you bleed" vs "the bandit bleeds" is the viewer's perspective, not the event's.
- Rejections are addressed to the actor's seat only, not world history.
- Multiplayer: each seat receives the Events whose source or target it can perceive.

## Layout

```
src/game/
  components.ts   registry, Entity, With, has
  world.ts        World, entity get/insert/update/remove
  effects.ts      Effect, applied
  stats.ts        statOf
  events.ts       GameEvent, Who, Cause
  tick.ts         tick, act, TICK
  actions/        Intent, Deed, Plan, RULES (one module per Rule family)
  systems/        one module per system
  content/        archetypes, abilities, conditions, factions, items: all aesthetic terms
  hex.ts sight.ts terrain.ts mind.ts   unchanged pure helpers
```

## Recipes

| To add | Do | Not |
|---|---|---|
| Status effect (heal-over-time, burning, countdown) | Row in `CONDITIONS` | Branch in a Rule or system |
| Ability, spell, potion | Row in `ABILITIES` composing Effects | Per-ability function |
| Creature, NPC, spawner kind | Row in archetypes | New entity type |
| Faction | Row and relations in `factions.ts` | `!==` on factions |
| Attribute | `Stats` key; read via `statOf` | Reading a base value |
| Per-tick world behaviour | Module in `systems/`, entry in `TICK` | Logic in `tick` |
| Player action | `Deed` member and its Rule (mapped type forces narration) | Special case in `settled` |
| Multi-turn action | Channel condition with `onExpire` | A scheduler |
| Quest | Condition with `data` and `reactions` | Fields on the player |
| Concern shared by several kinds | Component | Optional fields on an existing one |

## Multiplayer

The design keeps it open; nothing is built for it now.

- State is plain data (Maps serialised by a codec), the reducer pure and seeded: a server runs `tick` authoritatively; clients send Intents and receive Events.
- Seats, not a player: sight, streaming and `isOver` are per seat.

## Migration

Each phase keeps tests green and is one commit or more.

1. Components registry, `Entity`, `With`, `has`; `World` holds entities by id. Player and creatures become entities; delete `=== PLAYER` branches and `game.player`.
2. Event envelope: source, target, cause on every Event; narration takes a viewer.
3. Effects and conditions: afflictions → `CONDITIONS` rows; player regeneration → condition; `CREATURE_SPELLS` → `ABILITIES`.
4. Factions table and `relationOf`.
5. Spawners as derived entities with health, conditions, spawn ability and `onDepleted`; `streaming` system.
6. `tick` with simultaneous decisions; `Session` clock (manual, automatic, paused).
7. `Stats` and `statOf`.
8. Split `game.ts` into the layout; update [action-pipeline.md](action-pipeline.md), [monster-ai.md](monster-ai.md), [towns.md](towns.md) and the README.

## Prior art

- **ECS** (Bevy, Adam Martin): components as the unit of data, systems as the unit of behaviour, queries by component. Adopted as types; storage rejected. [Bevy-ECS; T-Machine-1]
- **Caves of Qud**: parts (components) on one object type, behaviour via events parts react to. Source of condition `reactions`. [Qud-Events]
- **Brogue CE**: one bolt table for wands and monster spells. Source of one `ABILITIES` table for all entities. [Brogue-CE Items.c]
- **Game Programming Patterns, Type Object**: archetypes and condition types as data rows. [GPP-TypeObject]

Sources as in [action-pipeline.md](action-pipeline.md#sources).
