# Action Pipeline

Research snapshot at `1f6fecd`. Sources: [Sources](#sources).

Goal: any actor's intent becomes zero-or-more authoritative results through one pipeline; situational rules live per action kind, not in switches scattered across `actOn`, `session.ts`, and `mode.ts`.

## Recommendation

- Keep the pure reducer `act(game, action) => Game`. Add one `resolve` loop over a per-kind rule table, Hauberk-style: a rule performs (with a turn-cost flag), substitutes another action, or rejects. [Hauberk action.dart:144-165]
- Move-into-occupant becomes a substitution to `attack`, not a `playerTurn` branch. [Hauberk walk.dart:25-28; `src/game/game.ts:607`]
- Collapse the 8 `endTurn` call sites into the loop. [`src/game/game.ts:485, 510, 523, 696, 896, 903, 911, 915`]
- Move potion-vs-spell slot dispatch from `session.ts:85-91` into `mode.ts`; chest-open detection from `session.ts:60-66` becomes a rule-emitted event.
- Do not adopt ECS. Do not split CQRS as a named structure; the write side (`act`) and read side (`Session`, `narrationOf`, `draw`) already exist. Consider an intent log for replay only if regression tests need it.

## Glossary

Proposed layering: `Intent` → `Command` → `Action` → `Resolution` → `GameEvent`.

| Term | hexrl today | Hauberk | Inform 7 | Caves of Qud | Rust tutorial (ECS) | CQRS / ES |
|---|---|---|---|---|---|---|
| Intent | `Intent`, `session.ts:31` | `Behavior`, hero input source [behavior.dart:10-16] | parser input | UI input | `WantsTo*` component [§2.6] | command (UI-side) |
| Command | `Command`, `mode.ts:126` | none (behavior emits Action) | parser → action | none | none | none |
| Action | `Action`, `game.ts:164` | `Action`, action.dart:13 | action (name + noun) | none (event) | intent component consumed | command |
| Rule | `actOn` branch, `game.ts:894` | `onPerform`, action.dart:66 | rulebook rule | `HandleEvent`, Modding:Events | system `run` | command handler |
| Substitution | `playerTurn` bump, `game.ts:607` | `alternate`, action.dart:144 | none direct | none | none | none |
| Check | `unreadinessOf` `game.ts:671`, `aimProblemOf` `:651`, `canStep` | `canOccupy` walk.dart:46 | Check rulebook | none | `if` in system | validation |
| Rejection | `Rejection`, `game.ts:167`; `rejected` `:236` | `fail()`, action.dart:132 | Check failure | `return false` (stops) | none | rejected command |
| Cost | `SPELLS.mp`/`cooldown` spells.ts:220; `endTurn` | `consumesEnergy`, action.dart:34; `FocusAction` action.dart:181 | none | none | `clear()` | none |
| Effect | `EFFECTS`, `game.ts:621`; `hit` `:596` | `onPerform` body | Carry Out rules | `FireEvent` body | system body | handler |
| Event | `GameEvent`, `game.ts:181` | `Event`/`EventType`, event.dart:10-59 | none (report rules) | string/min events | none | domain event [Fowler-DE] |
| Turn | `endTurn`, `game.ts:889`; `game.turn` | `Energy`, energy.dart:4-43; `Game.update`, game.dart:80 | turn | none | none | none |
| Actor | `game.player`, `Monster` | `Actor`, actor.dart; `getAction`, :131 | actor | parts on object | entity | none |
| Immediate reaction | none (`dropLoot` inline, `game.ts:407`) | `addAction` immediate, action.dart:74-77 | after rules | handler | none | none |
| Passive action | `populate`, `regenerate` in `endTurn` | `bindPassive`, action.dart:48; game.dart:211 | none | none | none | none |

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

Deleted or merged: `actOn` (`game.ts:894-916`) → dispatch; `playerTurn` and `melee` (`game.ts:607-616`) → `move`/`attack`; eight `endTurn` sites → one; `session.ts:85-91` slot split → `mode.ts` (`slot` command resolves against `player.loadout`); `session.ts:60-66` chest geometry → rule-emitted event read by `Session`.

Monsters (phase 2): monsters produce `Action`s with an `actor` field, consumed by the same `resolve`, as Hauberk binds actor to action [action.dart:40-45]. This retires `strike` (`game.ts:786`) and `monsterTurn`'s direct damage. Requires `attack` to target the player.

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
- Greg Young's CQRS document, Nystrom's "Is There More to Game Architecture than ECS?" talk, and Bucklew's IRDC 2015 talk were not retrieved; no claims rest on them.

## Sources

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
