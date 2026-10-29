# Hauberk Actions

Study of Hauberk's command/result system: how input and AI become `Action`s, how an `Action` either performs, fails, or returns an alternate, and how `Game.update()` runs the result. Prior art for [action-pipeline.md](action-pipeline.md). Contrast drawn against `move` + `MOVE_FALLBACKS` in `src/game/game.ts`.

## Sources

- Hauberk: `munificent/hauberk` @ `6c5c684` (depth-1 clone). Paths below are `lib/src/...` unless noted. https://github.com/munificent/hauberk
- Nystrom-2014: "A Turn-Based Game Loop". https://journal.stuffwithstuff.com/2014/07/15/a-turn-based-game-loop/ (read via fetch; quotes paraphrased). Differences noted under "Versus the 2014 post".

## Vocabulary

| Term | Meaning | Code |
|---|---|---|
| Action | Unit of work bound to an actor; `perform()` returns an `ActionResult`. Actions are mutable objects with `onPerform()` bodies. | `engine/action/action.dart:13`, `:62-66` |
| Behavior | Hero-only; what the hero is doing between inputs (one-shot, rest, run). Produces Actions on demand. | `engine/hero/behavior.dart:17-20` |
| Ability | Hero skill; produces an Action when used. Not an Action. | `engine/hero/ability.dart:11` |
| Move | Monster special (spell, breath, summon). Produces an Action. | `engine/monster/move.dart:9-45` |
| MonsterState | Monster AI per mood state; produces an Action. | `engine/monster/monster_states.dart:68-81` |
| Alternative | `ActionResult` payload: an Action to run in place of the failed one. | `action.dart:156-179` |
| Immediate | `isImmediate`: side-effect Action run before the parent continues; default `true`. | `action.dart:36-38`, `game.dart:186-192` |
| Event | Visual/UI record (`EventType`), not rules state. | `engine/core/event.dart:10-59` |
| Log | Text message, separate from Events. | `engine/core/log.dart` |

## Input becomes an Action

- Keys map to `Input` enum values in `web/main.dart:109-193` (e.g. `Input.nw` on `KeyCode.i`, `Input.ok` on `KeyCode.enter` / `numpad5`). Grep found no mouse or pointer handling in `lib/src/ui/` or `web/`.
- `GameScreen.handleInput` (`lib/src/ui/game/game_screen.dart:168`) switches on `Input`:
  - Directions: `WalkAction(Direction.n)` etc. (`:216-233`); `ok` is `WalkAction(Direction.none)` (`:224-225`), which becomes rest (`walk.dart:19-21`).
  - Runs: `game.hero.run(dir)` sets a `RunBehavior` (`:235-250`), no Action yet.
  - Rest: `game.hero.rest()` sets a `RestBehavior` (`:203-207`, `hero.dart:331-351`).
  - Abilities, operate, pick-up, fire: build an Action and call `hero.setNextAction` (`:281`, `:302`, `:368`, `:492`, `:505`, `:529`, `:538`, `:569`).
- `Hero.setNextAction(action)` stores `ActionBehavior(action)` (`hero.dart:326-328`). `ActionBehavior.getAction` calls `hero.waitForInput()` then returns the Action once (`behavior.dart:24-37`).
- `Hero.needsInput` is true when `_behavior == null` and a behavior that can no longer `canPerform` is dropped (`hero.dart:121-127`). `waitForInput()` clears behavior (`hero.dart:322-324`). `disturb()` clears any non-one-shot behavior (`hero.dart:357-359`); monsters that move in view call it (`monster.dart:434-440`).
- The UI never mutates the engine: it only sets a behavior or pushes a dialog. Dialogs return via `activate` (`game_screen.dart:308-374`), which also calls `setNextAction` for `ActionAbility` (`:366-368`).
- Ability Actions are wrapped by `_wrapFocusCost` (`ability.dart:40-44`), which returns `FocusAction(cost, action)` when cost > 0. Mixins `ActionAbility` / `TargetAbility` / `DirectionAbility` pick the factory (`ability.dart:48-83`).

## The Action base

- Binding: `bind(game, actor, {consumesEnergy})` sets actor, pos (from actor), game, energy flag (`action.dart:40-45`). `bindPassive` for dungeon-created actions has no actor and `consumesEnergy = false` (`:48-52`).
- `perform()` delegates to `onPerform()` (`:62-66`). Subclasses override `onPerform` only.
- Helpers:
  - `succeed([msg])` / `fail([msg])`: log only if visible or actor is hero (`:122-142`). `fail` returns `ActionResult.failure`.
  - `alternate(action)`: rebinds the alternative to the same actor and energy flag, returns `ActionResult.alternate(action)` (`:144-147`).
  - `doneIf(bool)`: `success` or `notDone` (`:151-153`).
  - `addAction(action, [actor])`: enqueue a consequence (`:74-77`).
  - `addEvent(type, ...)` (`:79-99`), `log`, `show` (`:111-120`).
- `ActionResult` (`:156-179`): `succeeded`, `done`, and `alternative`. Constants `success`, `failure`, `notDone`. `ActionResult.alternate(a)` is `succeeded: false, done: true, alternative: a`.
- `FocusAction` (`:182-198`): checks `hero.focus < cost` → `fail("You aren't focused enough.")`; else `spendFocus` then `alternate(_action)`. Cost is spent before the wrapped action runs; no refund if it fails afterwards (`game.dart:94-99` cascades, no undo).
- `GeneratorActionMixin` (`:203-223`): multi-frame Actions written as `sync*` generators; used by `AxeSweepAction` / `SpearStabAction` (`content/ability/weapon/`). `LosAction` (`engine/action/los.dart:7-44`) is a per-tile step action with `isImmediate => false`.
- Energy: `consumesEnergy` set at bind (`action.dart:21`, `:44`). Passive actions are not energy-bearing (`:51`, `:59`).

## Concrete Actions and their alternates

Every `alternate(` call in `lib/src` (grep-complete at `6c5c684`):

| Site | Trigger | Alternative |
|---|---|---|
| `engine/action/walk.dart:20` | `WalkAction(Direction.none)` | `RestAction` |
| `walk.dart:28` | actor on target hex, not self | `AttackAction(target)` |
| `walk.dart:41` | closed door the actor can open, or non-enterable tile that `canOperate` | `tile.onOperate!(pos)`: `OpenDoorAction` / `CloseDoorAction` / `OpenChestAction` / `OpenBarrelAction` (`content/tiles.dart:10-22`, `:184-189`) |
| `item.dart:139` | `EquipAction` on an already-equipped item | `UnequipAction` |
| `item.dart:241` | `UseAction` | the item's `use()` action |
| `toss.dart:38` | `TossAction` | `TossLosAction` (flight) |
| `action.dart:196` | `FocusAction` after paying | the wrapped action |
| `monster.dart:510` | `ChangeMonsterStateAction` | the new state's `getAction` |
| `content/action/ray.dart:150`, `:165` | `RingSelfAction` / `RingFromAction` | `RayAction.ring` |
| `content/action/flow.dart:76`, `:89` | `FlowSelfAction` / `FlowFromAction` | `FlowAction` |
| `content/action/illuminate.dart:40` | illuminate | `IlluminateAction` |

Other ways a result is produced without `alternate`:

- Plain failure with a message: `CloseDoorAction` fails "in the way" (`walk.dart:113-116`); `WalkAction` into a non-occupiable tile fails "hit[s] the …" (`walk.dart:46-54`, which also explores the tile for the hero); `PickUpAction` fails when no room (`item.dart:75-77`).
- Side effects queued: `toss.dart:104` (`addAction(toss.use!(pos))`); `combat.dart:242-244` (elemental side effect on defender, immediate); `monster.dart:388-393` (move on damage); `content/action/polymorph.dart:37`; `element.dart:29`.
- Stateful multi-step: `ClubBashAction` uses `_step` and `doneIf` (`content/ability/weapon/club_bash.dart:31-80`); `isImmediate => false`.

### WalkAction (the central case)

`WalkAction(dir)` (`walk.dart:11-87`) decides in order:

1. `dir == none` → rest (`:19-21`).
2. Actor at target → attack (`:26-29`). Attack is decided before terrain.
3. Operable tile (door, chest, barrel) → operate (`:36-43`). Doors are opened only when the actor can pass (`:37-40`), so walking through an open door does not close it.
4. Not occupiable → `fail` with a terrain message (`:46-54`).
5. Move; hero picks up treasure and notes other items; regenerate focus (`:56-80`).
6. `succeed()`.

`AttackAction(defender)` (`attack.dart:6-26`) has no preconditions in its body; it always returns `ActionResult.success` (`:18`). Its only `alternate`-path constructor is `walk.dart:28`.

`AttackAction` does not check adjacency or facing. Adjacency is implied by `WalkAction`'s choice of direction; this is the coupling discussed below.

## Game loop

`Game.update()` (`engine/core/game.dart:80-173`):

1. Pop-and-perform loop over `_actions` (`:85-87`). Calls `action.perform()`.
2. Cascade: while `result.alternative != null`, replace the head of the queue with the alternative and perform it (`:94-99`). `action` ends as the last alternative in the chain.
3. Reactions (immediate actions queued by `addAction`) run before the next queued action; they cascade alternatives and `assert(result.succeeded)` (`:102-113`).
4. `stage.refreshView()` (`:115`).
5. If `result.done`: remove the head; if `succeeded && action.consumesEnergy`, call `action.actor!.finishTurn(action)` and `stage.advanceActor()` (`:117-123`). Failed actions spend no energy and do not advance the actor.
6. Return to the UI (`:132-134`) when the action is not done, the hero acted, or events are pending. Monsters do not force a return unless they produced events.
7. When the queue is empty: if the current actor can take a turn and `needsInput` (hero waiting), return `WaitingUpdateResult` (`:143-149`). Otherwise gain energy and add `actor.getAction(this)` (`:151-156`), or advance the actor (`:157-160`).

Consequence for failures: after a failed action with `consumesEnergy`, the same actor is still current and still has energy, so its `getAction` is called again in the same `update()` (`:143-156`). For the hero this re-prompts input. For a monster it retries its AI. See Unresolved questions.

Energy (`engine/core/energy.dart`):

- `normalSpeed = 6`, `actionCost = 240` (`:6`, `:9`).
- `gains` table indexed by speed (`:12-26`). `gain(speed)` adds and returns `canTakeTurn` (`:34-37`). `spend()` subtracts `actionCost` (`:40-43`).
- Hero starts with `energy = actionCost` so it acts first (`hero.dart:105-107`).
- `Actor.finishTurn` spends energy and ticks conditions (`actor.dart:243-259`).
- Speed: `Actor.speed` = `baseSpeed + haste - cold` (`actor.dart:73-78`); monsters `normalSpeed + breed.speed` (`monster.dart:139`).

Substances update one tile per pass, as passive Actions (`game.dart:211-226`, `bindPassive`).

## Monsters

- `Actor.getAction(game)` binds the action returned by `onGetAction` (`actor.dart:131-135`). `Game.update` calls it when the monster has energy (`game.dart:156`).
- `Monster.onGetAction` (`monster.dart:151-225`):
  - Recharges moves, updates alertness and fear (`:153-171`).
  - Picks a state transition as `ChangeMonsterStateAction` (`:183-219`), otherwise `_state.getAction(game)` (`:223`).
- `ChangeMonsterStateAction` shows a message, emits an optional event, changes state, and `alternate`s to the new state's Action (`:490-512`, `:510`).
- `MonsterState.getAction` (`monster_states.dart`):
  - `AsleepState` → `RestAction()` (`:136-139`).
  - `AwakeState` → escape substance (`WalkAction`, `:146-147`); use the best usable move (`:150-153`); immobile breeds rest or attack adjacent (`:156-160`); otherwise pick melee or ranged path and return `WalkAction(_meander(...))` (`:238`).
  - `AfraidState` → rest if occluded, else `WalkAction` away, else `monster.awaken().getAction` (`:423-458`).
- Monsters use the same `WalkAction` as the hero. A monster walking into the hero is turned into `AttackAction` by `walk.dart:26-29`; there is no monster-specific attack choice. The monster AI chooses a direction and never names an attack.
- Moves: `Move.getAction(game, monster)` calls `monster.useMove(this)` then `onGetAction` (`move.dart:38-41`). `shouldUse(game, monster)` gates voluntary use (`:30`); `shouldUseOnDamage` gates on-hit use (`:34`). Ranged moves are `RangedMove` with an `Attack` (`:51-58`), which `AwakeState` reads to choose ranged vs melee.
- `Monster.onTakeDamage` queues a move as a side-effect `addAction(..., this)` (`monster.dart:388-393`). Move Actions and monster Walk/Attack share one queue.

## Events versus log

- `Event` (`engine/core/event.dart:10-30`): `type`, `pos`, `dir`, `element`, `actor`, `item`, `amount`. Types (`:34-59`) include `die`, `hit`, `toss`, `gold`, `awaken`, `frighten`. Content adds its own in `content/events.dart` (e.g. `knockBack`, `slash`, `teleport`).
- Events are produced by `addEvent` from Actions (`action.dart:79-99`) and `Game.addEvent` (`game.dart:194-196`).
- `Event` is consumed only by the UI: `ProgressUpdateResult.events` (`game.dart:259-263`) → `StagePanel.update` → `addEffects` (`ui/panel/stage_panel.dart:56-63`, `ui/effect/effect.dart:24-110`). No rule reads Events.
- Log is separate: `action.log/show/succeed/fail` write `Log` messages (`action.dart:111-142`, `log.dart:86-92`). Messages are not Events; `fail` logs an error only when visible or the actor is the hero.
- `combat.dart:251-256` emits `EventType.hit` and logs the attack verb separately.

## Synthesis

- An action is a mutable Action object bound to one actor. It owns its situational logic and returns one of: success, notDone, failure (with optional log), or an alternative Action.
- An alternative is a result, not a table entry. The Action that discovers the situation returns the substitute (`walk.dart:20-41`). The caller performs it without knowing why. The cascade is generic (`game.dart:94-99`).
- Situational logic lives in the Action that knows the situation: `WalkAction` knows about actors, doors, chests and terrain; `FocusAction` knows about focus; `ChangeMonsterStateAction` knows about states.
- There is no intent/fallback table because the decision is made at perform time, from live state, by the Action itself. Nothing needs to be classified after a rejection.
- One pipeline for hero and monsters: both produce Actions into the same queue (`game.dart:156`, `:85-87`). Hero input is a behavior that yields Actions (`behavior.dart:17-20`).
- Failure spends nothing for the hero and for monsters (`game.dart:117-123`), matching the 2014 post's "considers it to have never happened" rule.

## Contrast with hexrl

hexrl (`src/game/game.ts`):

- `move` is a Deed-less convenience (`Move`, `game.ts:124-127`). `attemptOf` tries `step` first, then `MOVE_FALLBACKS[outcome.reason]` (`game.ts:1014-1023`). Table has two entries: `not-facing` → `turn`, `occupied` → `attack` (`:1004-1012`).
- `step` refuses with `not-facing`, `blocked`, `occupied` (grep `const step: Rule`); `turn` refuses `already-facing`; `attack` refuses `no-target`, `out-of-reach`, `not-facing`.
- Rejections are typed (`game.ts:197-210`). The fallback is chosen from the rejection, after the fact.
- `move` never sees the situation directly. `occupied` is known only because `step` rejected with that reason.
- Monsters choose Deeds explicitly: `choiceOf` returns `turn`, `step` or `attack` (grep `const choiceOf`).

Differences that matter:

1. Where the decision lives: hexrl's fallback is a table outside all Rules; Hauberk's is inside the Action that sees the situation (`walk.dart:26-41` vs `game.ts:1004-1012`).
2. Failure cost: hexrl's `rejected` Event spends nothing; a rejected monster Deed costs its turn (per `action-pipeline.md`). Hauberk: failed actions spend no energy for anyone (`game.dart:117-123`). Hauberk's monster AI retries in place instead (see Unresolved).
3. Monster AI: hexrl monsters name `attack`; Hauberk monsters walk and let `WalkAction` attack (`monster_states.dart:238`, `walk.dart:26-29`).
4. Cascade depth: hexrl runs `step`, then at most one fallback (`attemptOf`). Hauberk cascades alternatives until one returns done (`game.dart:94-99`).
5. Facing: Hauberk has no facing rule. hexrl requires facing before a step.

## Hauberk-faithful sketch for hexrl

Keep hexrl's pure style: rules return outcomes, no mutation. Alternatives are values returned by the rule that owns the decision. `move` owns the facing and occupancy decision because it has the situation; `step` stays isolated.

```ts
type Verdict =
  | { readonly kind: "performed"; readonly game: Game; readonly spendsTurn: boolean }
  | { readonly kind: "rejected"; readonly reason: Rejection }
  | { readonly kind: "alternate"; readonly action: Deed };

type Rule<A extends Deed> = (game: Game, action: A, actor: ActorId) => Verdict;

// Owns: facing, and "a foe is in the way". Knows no rejection reasons.
const move: Rule<Move> = (game, { direction }, actor) => {
  const { at, facing } = bodyOf(game, actor);
  if (facing !== direction) return { kind: "alternate", action: { kind: "turn", direction } };
  const to = add(at, DIRECTIONS[direction]);
  if (isFoeAt(game, actor, to)) return { kind: "alternate", action: { kind: "attack", at: to } };
  return { kind: "alternate", action: { kind: "step", direction } };
};

// Owns: terrain and occupancy. Still knows nothing of attacks or facing.
const step: Rule<Step> = (game, { direction }, actor) => { /* blocked / occupied as today */ };

// settled(): cascade alternates until a performed or rejected verdict.
const settle = (game: Game, actor: ActorId, deed: Deed, depth = 0): Settlement => {
  const verdict = RULES[deed.kind](game, deed, actor);
  if (verdict.kind === "alternate") return settle(game, actor, verdict.action, depth + 1);
  // ... performed / rejected as today
};
```

Ownership in this sketch:

- `move`: facing and whether a foe occupies the target. Analogue of `WalkAction`.
- `turn`, `step`, `attack`: unchanged isolated Rules.
- `settle`: generic cascade, analogue of `Game.update` (`game.dart:94-99`). Depth should be bounded (`alternate` cycles must not loop).
- `MOVE_FALLBACKS` and the `Rejection`-keyed lookup in `attemptOf` disappear.

`step` keeps its `occupied` rejection, but `move` now decides occupancy first, so `step`'s `occupied` becomes a defence rather than a routing signal. `attack` keeps its own facing check (`game.ts`, `attack` rule); with `move` checking facing first, that check is only a guard.

Trade-offs:

- Encapsulation vs coupling. `move` now knows `attack` exists. Hauberk's `WalkAction` does the same (`walk.dart:26-29`). The benefit is one place that answers "what happens when I walk here". The cost is that `move` imports the `attack` Deed and the notion of foe. Under hexrl's rule that a Rule "knows no other Deed", this breaks the rule. Accepting it means revising that rule in `action-pipeline.md`.
- Testability. The table version tests each fallback independently. The sketch tests `move` as a function of state, which is simpler but couples `move`'s tests to occupancy.
- Depth. Hauberk cascades arbitrarily. hexrl's sketch cascades unbounded in theory. A depth guard or a fixed set of alternates (move → turn | attack | step) keeps it finite.

### Where facing fits

Hauberk has no facing, so no analogue exists. In the sketch, facing is the first branch of `move` and is owned by it, not by a rejection-keyed table. A Hauberk-style `turn` is an alternative returned by `move`. `turn` remains an isolated Rule and still rejects `already-facing`; `move` never produces that case.

Alternative designs, not recommended without a user decision: make facing a property checked by `step` and handled by a `FocusAction`-style wrapper; or make `move` an `Ability` (Hauberk's `ActionAbility` pattern, `ability.dart:48-54`) so facing becomes a cost-like wrapper.

## Other observations

- `FocusAction` spends before the wrapped action runs (`action.dart:192-196`). If the wrapped action then fails, focus is not refunded. hexrl's rule that a rejected Action spends nothing differs here.
- `Hero.needsInput` returns true only for a hero with no behavior (`hero.dart:121-127`). `RunBehavior` and `RestBehavior` `canPerform` can clear the behavior and return input to the player (`:122-124`, `behavior.dart:46-59`).
- `ClubBashAction` and `AxeSweepAction` are multi-step Actions that return `notDone` between frames (`club_bash.dart:44-76`). `Game.update` returns to the UI each `notDone` (`game.dart:132-134`), so animation and gameplay share the loop.
- `LightningBoltSpell.onGetAction` is `throw UnimplementedError()` (`content/ability/spell/lightning_bolt.dart:22-25`).

## Versus the 2014 post

- Post: alternates are followed in a loop until success or failure (Nystrom-2014). Code: same, plus `ActionResult.alternative` is a field, not a return of a second Action (`action.dart:156-179`, `game.dart:94-99`).
- Post: "Right now every action costs the same amount of energy" (Nystrom-2014). Code: `actionCost = 240` is flat, and speed controls gain via `gains` (`energy.dart:9-26`). Same model, extended.
- Post: failed actions do not advance the loop, so the turn is not spent (Nystrom-2014). Code: same for energy and actor advance (`game.dart:117-123`). Code adds that the same actor retries in the same `update` call (`:143-156`); the post does not describe this.
- Post: the hero's input creates an action via `setNextAction()` (Nystrom-2014). Code: `setNextAction` now wraps an `ActionBehavior` (`hero.dart:326-328`) and behaviors (run, rest) exist beyond the post's one-shot model (`behavior.dart`).
- Post: monsters' walk becomes attack or open-door alternates (Nystrom-2014). Code: same (`walk.dart:26-41`), plus `ChangeMonsterStateAction` and moves are also alternates or immediate side-effects (`monster.dart:388-393`, `:510`).

## Unresolved questions

- Monster livelock: if a monster's chosen Action fails repeatedly and deterministically, `Game.update` re-calls `getAction` in the same pass without advancing (`game.dart:143-156`). Not run; whether any monster AI path can produce such a loop is unverified.
- Does hexrl want `move` to know `attack` (sketch) or keep the table and accept hidden coupling through `MOVE_FALLBACKS`? Needs a user decision; it changes the "Rule knows no other Deed" rule in `action-pipeline.md`.
- Should facing be a Rule-level check (sketch), a wrapper, or an Ability? No Hauberk precedent.
- Should hexrl adopt a refund-free `FocusAction`-style cost wrapper or keep "use pays its costs itself, rejection spends nothing"?
