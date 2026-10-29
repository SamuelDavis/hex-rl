# Action Pipeline

Research snapshot at `1f6fecd`. Sources: [Sources](#sources).

Goal: any actor's intent becomes zero-or-more authoritative results through one pipeline; situational rules live per action kind, not in switches scattered across `actOn`, `session.ts`, and `mode.ts`.

## Recommendation

- Keep the pure reducer `act(game, action) => Game`. Add one `resolve` loop over a per-kind rule table, Hauberk-style: a rule performs (with a turn-cost flag), substitutes another action, or rejects. [Hauberk action.dart:144-165]
- Move-into-occupant becomes a substitution to `attack`, not a `playerTurn` branch. [Hauberk walk.dart:25-28; `src/game/game.ts:607`]
- Collapse the 8 `endTurn` call sites into the loop. [`src/game/game.ts:485, 510, 523, 696, 896, 903, 911, 915`]
- Move potion-vs-spell slot dispatch from `session.ts:85-91` into `mode.ts`; chest-open detection from `session.ts:60-66` becomes a rule-emitted event.
- Spells and monster abilities share one effect vocabulary and one `applyEffect`, as Brogue shares `attack()` and `zap()` between player and monsters. [Brogue-CE Combat.c:1014; Items.c:6582; Monsters.c:2751]
- Do not adopt ECS. Do not split CQRS as a named structure; the write side (`act`) and read side (`Session`, `narrationOf`, `draw`) already exist. Consider an intent log for replay only if regression tests need it; if so, log performed actions only, since Brogue erases cancelled keystrokes. [Brogue-CE Recordings.c:147]

## Glossary

Proposed layering: `Intent` → `Command` → `Action` → `Resolution` → `GameEvent`.

| Term | hexrl today | Hauberk | Inform 7 | Caves of Qud | Rust tutorial (ECS) | CQRS / ES | Brogue CE |
|---|---|---|---|---|---|---|---|
| Intent | `Intent`, `session.ts:31` | `Behavior`, hero input source [behavior.dart:10-16] | parser input | UI input | `WantsTo*` component [§2.6] | command (UI-side) | direction arg to `playerMoves` [Movement.c:842] |
| Command | `Command`, `mode.ts:126` | none (behavior emits Action) | parser → action | none | none | none | none in `playerMoves` |
| Action | `Action`, `game.ts:164` | `Action`, action.dart:13 | action (name + noun) | none (event) | intent component consumed | command | none; one function per path (`playerMoves`, `monstersTurn` [Monsters.c:3307]) |
| Rule | `actOn` branch, `game.ts:894` | `onPerform`, action.dart:66 | rulebook rule | `HandleEvent`, Modding:Events | system `run` | command handler | imperative branches [Movement.c:842-1243]; per-flag reaction [Time.c:101] |
| Substitution | `playerTurn` bump, `game.ts:607` | `alternate`, action.dart:144 | none direct | none | none | none | in-branch return: whip/spear replace move [Movement.c:936-943] |
| Check | `unreadinessOf` `game.ts:671`, `aimProblemOf` `:651`, `canStep` | `canOccupy` walk.dart:46 | Check rulebook | none | `if` in system | validation | `diagonalBlocked` [Movement.c:824]; hazard prompts [Movement.c:1054-1104] |
| Rejection | `Rejection`, `game.ts:167`; `rejected` `:236` | `fail()`, action.dart:132 | Check failure | `return false` (stops) | none | rejected command | `cancelKeystroke(); return false` [Movement.c:1054-1056] |
| Cost | `SPELLS.mp`/`cooldown` spells.ts:220; `endTurn` | `consumesEnergy`, action.dart:34; `FocusAction` action.dart:181 | none | none | `clear()` | none | ticks: `attackSpeed` [Time.c:2214-2225] |
| Effect | `EFFECTS`, `game.ts:621`; `hit` `:596` | `onPerform` body | Carry Out rules | `FireEvent` body | system body | handler | `attack()` [Combat.c:1014]; `updateBolt` switch [Items.c:4335] |
| Event | `GameEvent`, `game.ts:181` | `Event`/`EventType`, event.dart:10-59 | none (report rules) | string/min events | none | domain event [Fowler-DE] | none; `message()` inline |
| Turn | `endTurn`, `game.ts:889`; `game.turn` | `Energy`, energy.dart:4-43; `Game.update`, game.dart:80 | turn | none | none | none | tick loop [Time.c:2411-2490] |
| Actor | `game.player`, `Monster` | `Actor`, actor.dart; `getAction`, :131 | actor | parts on object | entity | none | one `creature` struct; `monst == &player` branches [Rogue.h:2240] |
| Immediate reaction | none (`dropLoot` inline, `game.ts:407`) | `addAction` immediate, action.dart:74-77 | after rules | handler | none | none | tile-entry hook on monster move [Monsters.c:3693]; player at turn end [Time.c:2599] |
| Passive action | `populate`, `regenerate` in `endTurn` | `bindPassive`, action.dart:48; game.dart:211 | none | none | none | none | `updateEnvironment` every 100 ticks [Time.c:2425-2454] |

## Prior art

### Hauberk (Dart roguelike, Bob Nystrom)

- Action binds actor, position, game, and `consumesEnergy` on creation. [Hauberk action.dart:40-45, 48-52]
- `ActionResult` has `succeeded` (energy consumed), `done` (no further processing), and `alternative` (action to perform instead). [action.dart:156-179] `alternate` inherits the parent's energy flag. [action.dart:144-147]
- Substitution examples: walking into an actor becomes `AttackAction` [walk.dart:25-28]; walking into a closed door becomes an operate action [walk.dart:31-41]; an uncrossable tile fails with a message and spends nothing [walk.dart:46-54; game.dart:117-122].
- Cost as wrapper: `FocusAction` spends focus, then `alternate`s to the wrapped action. [action.dart:181-198]
- Loop: cascades alternates until a terminal result [game.dart:93-99]; runs immediate sub-actions before continuing [game.dart:101-113; action.dart:74-77]; only `succeeded && consumesEnergy` finishes a turn [game.dart:117-122]; energy gained per actor per tick [energy.dart:34-37; game.dart:151].
- Hero and monsters share the loop. Hero input is a `Behavior` that waits for input [hero/behavior.dart:10-16; hero.dart:121-126]; monsters pick actions from state [monster_states.dart:81, 136-153].
- Monster state change is an action that alternates to the new state's action. [monster.dart:495-510]
- Events: `addEvent` appends to `Game._events` [action.dart:79-99; game.dart:194-196]; returned with the progress result [game.dart:180-183]. Event types are a fixed enum-like set [event.dart:34-59].
- Items: `ItemAction(location, item)` parameterizes where the item lives [item.dart:13-20, 27-40], analogous to `Where` (`game.ts:139`).
- Caveat: no cycle guard on alternates [game.dart:93-99].

### Brogue CE (roguelike, C)

Pinned `363440c` (2026-10-20). Player and monsters call the same effect functions; control flow stays imperative. Dynamic behaviour comes from flags and tables.

Player intent:
- `playerMoves(direction)` is one function, ~400 lines. Order: confusion randomizes direction and may prompt [Brogue-CE Movement.c:883-893]; enemy bump tries whip, then spear [Movement.c:936-943], then a captive prompt [Movement.c:956-964], then the hit list with abort prompts [Movement.c:972-1014]; hazard prompts for lava, auto-descent, fire, gas, pressure plates [Movement.c:1054-1104]; else move, pick up, lunge/flail, `playerTurnEnded` [Movement.c:1180-1227].
- Diagonal block: either orthogonal corner with `T_OBSTRUCTS_DIAGONAL_MOVEMENT` [Movement.c:824-839; Rogue.h:1909], checked in the move gate [Movement.c:931].
- Rejection is `cancelKeystroke()` plus `return false`, no turn [Movement.c:1054-1056]. The return value is not the turn flag: nausea vomit spends a turn and returns false [Movement.c:990-992], whereas vomit on a move returns true [Movement.c:1166-1168].
- Costs: attacks add `attackSpeed` [Movement.c:1012; Time.c:2214-2225]; freeing a captive too [Movement.c:963].

Scheduler:
- `playerTurnEnded` [Time.c:2242] advances the soonest actor while the player has ticks [Time.c:2411-2420]. Every 100 ticks: status decay, `updateEnvironment` (gas, fire, promotions, floor items) [Time.c:2425-2456]. Each due monster runs `monstersTurn` [Time.c:2476-2489].
- Per creature: `ticksUntilTurn`, `movementSpeed`, `attackSpeed` [Rogue.h:2269-2273]. Player 100/100 [Globals.c:1008]; ogre attacks every 200 [Globals.c:1042]; eel moves at 50 [Globals.c:1014]. Haste halves monster speeds [Items.c:3921-3931]; player speed via `updateEncumbrance` [Items.c:3170-3190].

Monsters:
- `monstersTurn` [Monsters.c:3307] branches on state inline. Hunting: spells first [`monstUseMagic`, Monsters.c:3416-3428], then ally attacks, then movement.
- Melee: `moveMonster` calls the same `attack()` the player uses [Monsters.c:3879; Movement.c:1006; Combat.c:1014].
- Spells: `monstUseBolt` casts with 30% per valid target [Monsters.c:2759-2785, roll at 2777], then `monsterCastSpell` → `zap()` [Monsters.c:2737-2757, call at 2751]. Player staffs and wands call the same `zap()` [Items.c:6582].

Terrain as data:
- `floorTileType`: glyph, colours, `chanceToIgnite`, `fireType`, `discoverType`, `promoteType`, `promoteChance` (hundredths of a percent per turn), `T_*` flags, `TM_*` mechanical flags [Rogue.h:1885-1896; 1903-1941]. Rows: grass ignites at 15, burns to `DF_PLAIN_FIRE`, vanishes [Globals.c:442]; foliage promotes on step to `DF_TRAMPLED_FOLIAGE` [Globals.c:467]; fire promotes to embers at 5%/turn [Globals.c:487]; caustic gas is a flammable GAS-layer tile, ignites at 100, `fireType` `DF_GAS_FIRE` [Globals.c:497].
- Reactions key on flags, not kinds. `TM_PROMOTES_ON_STEP` = creature | item [Rogue.h:1967]. `applyInstantTileEffectsToCreature` checks flags for any creature [Time.c:101; creature promotion 253-265; player entry 267-271]. Pressure plate spawns its `fireType` DF and promotes [Time.c:225-250]. Altar pickup promotes [Items.c:826-832; Globals.c:366]. Fire burns flammable floor items [Items.c:1234-1237]; deep water drifts them [Items.c:1240]. Monster path costs read the same flags [Movement.c:1850-1855].
- Dungeon feature: tile, layer, `startProbability`, `probabilityDecrement`, propagation terrain, `subsequentDF` [Rogue.h:1866-1880]. `spawnMapDF` spreads over cardinal neighbours, start % falling per ring [Architect.c:3290-3340]. Chain: burning hay spawns stench gas then `DF_PLAIN_FIRE` [Globals.c:447, 911; Architect.c:3480-3490].
- Gas is the only volumetric layer [Time.c:1246]. Each update averages volume over neighbours with stochastic rounding [Time.c:1247-1300], runs twice per environment update [Time.c:1460-1461], dissipates by flag at 20% or 50% per turn [Time.c:1299-1301].
- Fire: `exposeTileToFire` ignites on the max `chanceToIgnite` of flammable layers, promotes them via `fireType`, caps exposure at 12 per update [Time.c:1181-1240; 1188]. Burning cells expose four cardinal neighbours [Time.c:1525-1531]. Explosive gas (`TM_EXPLOSIVE_PROMOTE`) takes the explosion path when all 8 neighbours are fire, gas-blocking, or explosive [Time.c:1214-1226; Globals.c:502].
- Ability from data: bloat is `MA_KAMIKAZE | MA_DF_ON_DEATH` with `DF_BLOAT_DEATH` = 2000 caustic gas [Globals.c:1018-1019, 648]. Kamikaze kills in `attack()` [Combat.c:1028]; the death DF spawns in `killCreature` [Combat.c:1665-1667].

Bolts:
- One table, `boltCatalog_Brogue[]`, for wands, staffs, monster spells, and ranged attacks (arrow, whip) [GlobalsBrogue.c:58-90]. Entry: effect `BE_*` [Rogue.h:1804-1828], magnitude, `pathDF`, `targetDF`, forbidden monster flags, `BF_*` flags [Rogue.h:1829-1865]. Spiderweb: small web on path, large web at target [GlobalsBrogue.c:83].
- Items map to bolts by index: staff `power` [Items.c:4318-4324]; firebolt staff is `BOLT_FIRE` [Globals.c:1617]; dar battlemage casts `BOLT_FIRE` [Globals.c:1071]. Both reach `zap()` → `updateBolt()` → `detonateBolt()` [Items.c:4793, 4335, 4692].
- Flags are cross-system hooks needing no new code: `BF_FIERY` ignites tiles and creatures [Items.c:4435, 4662-4664]; `BF_ELECTRIC` promotes `TM_PROMOTES_ON_ELECTRICITY` tiles [Items.c:4673-4676; Rogue.h:1838, 1948]; `BF_PASSES_THRU_CREATURES` and `BF_HALTS_BEFORE_OBSTRUCTION` shape the path [Rogue.h:1830-1831].
- Effects are a switch: per-cell `updateBolt` [Items.c:4355-4420, `BE_DAMAGE` at 4365]; placement effects (obstruction, conjuration, blink, tunnel) in `detonateBolt` [Items.c:4692-4790]. A new effect means a new `BE_*` and a new case.
- Monster abilities are `MA_*` bit flags that modify `attack()` results: `MA_HIT_BURN`, `MA_CAUSES_WEAKNESS`, `MA_TRANSFERENCE` [Rogue.h:2086-2109; Combat.c:379-400, 1208]. `MA_CLONE_SELF_ON_DEFEND` splits on hit [Combat.c:208-215].

Assessment:
- Does well: flags and tables make new interactions data. Lightning reaches electric crystals through `BF_ELECTRIC` without a new code path [Items.c:4673; Globals.c:558]. One function per concept serves player and monsters (`attack`, `zap`, `applyInstantTileEffectsToCreature`). One tick scheduler handles per-actor speed [Time.c:2411-2490]. Keystroke recording rewinds cancelled input [Recordings.c:133-151].
- Relies on: `playerMoves` is imperative, with prompts interleaved with state changes and a return-value inconsistency [Movement.c:990-992]. `monst == &player` branches run through the same functions [Time.c:101-135]. Tile-entry reactions run in two places, on monster move [Monsters.c:3693] and at player turn end [Time.c:2599]. Effects dispatch by enum switch [Items.c:4355]. The map is global mutable state (`pmap`, `rogue`), incompatible with the pure reducer.
- Adopt: `Effect` data shared by `SPELLS` and monster abilities, applied by one function for all actors (see Recommendation). Chest-open as an emitted event for any actor. Promotion rules only once a second tile reaction exists. Hazard confirmation as a Resolution kind once hazards exist (Unresolved).
- Skip now: tile bitmask flags, gas volume, fire spread, the tick scheduler. Hexrl is turn-based and single-speed; `src/game/terrain.ts` generates terrain and has no per-cell state (README: "Generation is `src/game/terrain.ts`"). Brogue's terrain depth pays off only with mutable cells.

### Inform 7 rulebooks

- Each action runs through Before, Instead, Check, Carry Out, After, Report, in that order. A Before rule ending with `instead` succeeds and shuts off further processing. A failed Check stops before Carry Out. [Inform-Handbook §"Action Processing"]
- Relevance: separates validity (Check) from effect (Carry Out) by name. Rule ordering is by rulebook placement, not priority numbers. Official manual not reached (see Sources).

### Caves of Qud (events on parts)

- Events fire on an object; each registered Part/Effect receives `FireEvent`/`HandleEvent`. Returning false stops later handlers. Handlers mutate event fields; the page describes no cancellation of the originating action. [Qud-Events]
- Relevance: reactions (e.g. on-kill) without the action knowing listeners. Cost: behaviour spreads across parts; ordering is implicit. Qud's per-object part set has no hexrl analogue yet.

### Roguelike Tutorial in Rust (intent components)

- Intent is a component inserted on the entity: `WantsToMelee { target }`; a system joins over it and calls `clear()` [Rust-Tutorial chapter_7.html, §2.6 "Player attacking and killing things"].
- Monsters reuse it by inserting the same component [chapter_7.html, §2.6 "Letting the monsters hit you back"].
- Potions: inventory UI inserts `WantsToDrinkPotion`; the system heals and deletes the potion entity [chapter_9.html, §2.8 "Using Items"].
- Relevance: closest to the proposed design. Intent is consumed once, the same for player and monsters. Cost: entity/storage machinery; hexrl's queued `Action` gives the same effect without it.

### Bevy ECS and entity systems

- Entities are ids; components are data; systems are functions over component sets; systems run in parallel by default. [Bevy-ECS]
- Adam Martin argued next-generation MMOGs would need an entity system. [T-Machine-1]
- Parallel execution is unused here: turns are serial by design. [Nystrom-2014]

### Game Programming Patterns: Component, Type Object

- Component: entity reduced to a container; communication via messages, direct references, or shared state; "start simple". [GPP-Component §"Components", §"Design Decisions"]
- Type Object: data-only type definitions; per-type behaviour is hard. [GPP-TypeObject §"Keep in Mind"]
- Relevance: `SPELLS` is a Type Object table (`spells.ts:233`); `EFFECTS` (`game.ts:621`) is the behaviour that the table cannot hold. Same split the book describes.

### CQRS and event sourcing (Fowler)

- CQRS: "a pattern", "useful in some places, but not in others"; "for most systems CQRS adds risky complexity". [Fowler-CQRS]
- Event sourcing: "Capture all changes to an application state as a sequence of events"; state derived by replay. [Fowler-ES]
- Domain event: "Captures the memory of something interesting which affects the domain". [Fowler-DE]
- Elm and Redux one-way flow already adopted in `ui-architecture.md` [Elm-Architecture; Redux-FAQ].

## Comparison

Constraints: about eight action kinds; two actor kinds; synchronous events; pure TypeScript reducer; deterministic (seeded, `game.ts:281`); single player; no real-time.

| Option | Fit | Verdict |
|---|---|---|
| Hauberk-style Action + Resolution | Covers substitution, cost, rejection in one loop; shares types with today's `Action` | Adopt |
| Inform-style ordered rulebooks | Powerful when many rules per action; here at most one rule per kind | Borrow phase names (check vs effect); skip the engine (YAGNI) |
| Qud-style event handlers on parts | Broadcast reactions; needs a listener registry | Defer until one event has two reactions (on-kill loot is inline, `game.ts:407`) |
| ECS (mutable, query-based) | Pays off with many cross-cutting traits (burning, wet, flammable across items, monsters, terrain) | Overkill: traits here are one tagged union; mutable stores conflict with the pure core |
| CQRS named split | Write side is `act`; read side is `Session`, narration, draw | Naming only; no structural change |
| Event-sourcing-lite (intent log) | Seed + intents reproduce a game; enables replay and golden tests | Cheap; adopt when a regression needs it |
| Brogue-style flags and tables (`tileCatalog`, `dungeonFeatureCatalog`, `boltCatalog`) | Fire, gas, items, and monsters react to each other through flags; pays off with mutable cells | Defer for terrain (no per-cell state today); adopt the shared effect table for spells and monsters now |

## Recommended pipeline

Types sketch (not final):

```ts
export type Action =
  | { readonly kind: "move"; readonly direction: Direction }
  | { readonly kind: "wait" }
  | { readonly kind: "attack"; readonly at: Hex }
  | Cast | Transfer | Bind | Quaff | Destroy;

export type Resolution =
  | { readonly kind: "performed"; readonly game: Game; readonly costsTurn: boolean }
  | { readonly kind: "substituted"; readonly action: Action }
  | { readonly kind: "rejected"; readonly reason: Rejection };

const resolve = (game: Game, action: Action): Game => {
  const outcome = resolutionOf(game, action);
  switch (outcome.kind) {
    case "substituted": return resolve(game, outcome.action);
    case "rejected": return rejected(game, action, outcome.reason);
    case "performed": return outcome.costsTurn ? endTurn(outcome.game) : outcome.game;
  }
};
```

`resolutionOf` is one exhaustive dispatch over `action.kind` to one function per kind. Situational logic lives in that kind's function:

- `move`: facing turn first (`game.ts:910`); terrain check (`canStep`); occupant (monster or spawner) → substitute `attack`; else step (`costsTurn: true`).
- `attack`: damage the occupant via `hit` (`game.ts:596`); `costsTurn: true`.
- `cast`: `castProblemOf` check (`game.ts:680`); spend mp and cooldown; run `EFFECTS`; `costsTurn: true`.
- `quaff`: consume potion; `costsTurn: false` (`game.ts:535-550` already free).
- `transfer`, `bind`, `destroy`: existing bodies minus their `endTurn` calls.

Brogue CE prices actions in ticks per actor (`attackSpeed`, `movementSpeed`) [Brogue-CE Rogue.h:2269-2273; Globals.c:1042]. Keep `costsTurn: boolean` while every hexrl actor acts once per turn; a non-uniform speed changes it to a tick count (see Unresolved).

Deleted or merged: `actOn` (`game.ts:894-916`) → dispatch; `playerTurn` and `melee` (`game.ts:607-616`) → `move`/`attack`; eight `endTurn` sites → one; `session.ts:85-91` slot split → `mode.ts` (`slot` command resolves against `player.loadout`); `session.ts:60-66` chest geometry → rule-emitted event read by `Session`.

Monsters (phase 2): monsters produce `Action`s with an `actor` field, consumed by the same `resolve`, as Hauberk binds actor to action [action.dart:40-45]. This retires `strike` (`game.ts:786`) and `monsterTurn`'s direct damage. Requires `attack` to target the player. Brogue CE confirms the shape: monster melee and player melee both reach `attack()` [Combat.c:1014; Monsters.c:3879], and monster spells reach the staff/wand `zap()` [Monsters.c:2751; Items.c:6582]. Monster abilities should reference the `SPELLS` effect kinds, not a parallel `strike`-style path.

Entry reactions (chest-open, phase 3) run from the `move` rule for any actor. Brogue splits this: monsters on position change [Monsters.c:3693], the player at turn end [Time.c:2599]. One place avoids the split.

Phasing, each step green on `game.test.ts` (830 lines), `session.test.ts`, `mode.test.ts`:
1. Normalize `Action` to tagged objects; add `kind` to `Cast`.
2. Add `resolve`; move→attack substitution; delete `playerTurn`/`melee`.
3. Move slot dispatch to `mode.ts`; chest-open as event.
4. Actor field; monsters through `resolve`; delete `strike`.

## Unresolved

- Should `attack` target the player (monster strikes) or stay occupant-only? Affects step 4.
- Does `mode.ts` keep a separate `Command` layer, or should `Intent` carry Command kinds directly? Only aim mode uses `Command` today.
- Is a cycle guard on `resolve` substitution needed, or is the rule table acyclic by construction?
- Reactive handlers (Qud-style): is there a second reaction to any event that would justify them?
- Does the intent log need to be persisted (save/replay), or only used in tests?
- Speed: will any hexrl actor act more or less than once per turn? Brogue's eel moves at 50 and ogre attacks at 200 [Brogue-CE Globals.c:1014, 1042]. If yes, `costsTurn: boolean` becomes a tick count.
- Hazards: Brogue prompts before lava, auto-descent, fire, gas, and pressure plates [Brogue-CE Movement.c:883, 1065-1104]; the captive prompt is skipped once committed [Movement.c:957]. Does a hexrl hazard need an `asks` Resolution (pure: prompt plus continuation), or a rejection with a reason?
- Area effects: Brogue spreads area DFs over cardinal neighbours with a falling start % [Brogue-CE Architect.c:3290-3340]; `fireballSplashOf` hardcodes the six neighbours at a fixed `FIREBALL_SPLASH` (`spells.ts:51`). Does a second area effect justify a data pattern?
- First stateful terrain: fire, gas, or the spawner wreck (`README.md`)? That decides whether tile flags such as "flammable" or "promotes on step" are worth adding.
- Greg Young's CQRS document, Nystrom's "Is There More to Game Architecture than ECS?" talk, and Bucklew's IRDC 2015 talk were not retrieved; no claims rest on them.

## Sources

- Brogue-CE: `tmewett/BrogueCE` @ `363440c` (master HEAD, committed 2026-10-20). Files: `src/brogue/Movement.c`, `Time.c`, `Monsters.c`, `Items.c`, `Combat.c`, `Architect.c`, `Recordings.c`, `Globals.c`, `Rogue.h`; `src/variants/GlobalsBrogue.c`. https://github.com/tmewett/BrogueCE . Line refs from raw fetch at this SHA (`raw.githubusercontent.com/tmewett/BrogueCE/363440c/src/...`). Primary source; no secondary commentary used.
- Hauberk: Bob Nystrom, `munificent/hauberk` @ `6c5c684` (2026-09-14). Files: `lib/src/engine/action/action.dart`, `walk.dart`, `attack.dart`, `item.dart`; `lib/src/engine/core/game.dart`, `actor.dart`, `energy.dart`, `event.dart`; `lib/src/engine/hero/hero.dart`, `behavior.dart`; `lib/src/engine/monster/monster.dart`, `monster_states.dart`. https://github.com/munificent/hauberk . Line refs from raw fetch at this SHA.
- Nystrom-2014: Robert Nystrom, "A Turn-Based Game Loop", journal.stuffwithstuff.com, 2014-07-15. https://journal.stuffwithstuff.com/2014/07/15/a-turn-based-game-loop/ (fetched; summary-level, not verbatim).
- Rust-Tutorial: Roguelike Tutorial in Rust (bracketproductions). §2.6 `chapter_7.html`; §2.8 `chapter_9.html`. https://bfnightly.bracketproductions.com/rustbook/chapter_7.html ; https://bfnightly.bracketproductions.com/rustbook/chapter_9.html (fetched; quotes from extracted text).
- Qud-Events: Caves of Qud modding wiki, "Modding:Events". https://wiki.cavesofqud.com/wiki/Modding:Events (fetched; summary-level).
- Inform-Handbook: Inform 7 Handbook v2.0 (community), "Action Processing", chapter 4. https://inform-7-handbook.readthedocs.io/en/v2.0/chapter_4_actions/action_processing/ (fetched; summary-level). Official Writing with Inform rulebook pages not reached (404; redirect not followed).
- Fowler-CQRS: Martin Fowler, "CQRS". https://martinfowler.com/bliki/CQRS.html (fetched).
- Fowler-ES: Martin Fowler, "Event Sourcing". https://martinfowler.com/eaaDev/EventSourcing.html (fetched).
- Fowler-DE: Martin Fowler, "Domain Event". https://martinfowler.com/eaaDev/DomainEvent.html (fetched).
- GPP-Component: Robert Nystrom, "Component". https://gameprogrammingpatterns.com/component.html (fetched).
- GPP-TypeObject: Robert Nystrom, "Type Object". https://gameprogrammingpatterns.com/type-object.html (fetched).
- Bevy-ECS: Bevy, "ECS" quick start. https://bevy.org/learn/quick-start/getting-started/ecs/ (fetched).
- T-Machine-1: Adam Martin, "Entity Systems are the future of MMOG development, Part 1", 2007-09-03. http://t-machine.org/index.php/2007/09/03/entity-systems-are-the-future-of-mmog-development-part-1/ (fetched; intro only).
- Elm-Architecture, Redux-FAQ: as cited in `docs/ui-architecture.md`.
- GPP-Command: as cited in `docs/ui-architecture.md`.
- Repo: `src/game/game.ts`, `session.ts`, `mode.ts`, `spells.ts`, at `1f6fecd`.
