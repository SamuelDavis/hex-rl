# Action Pipeline

Contract for turning any actor's choice into authoritative game events. One vocabulary, one execution path, for the player and monsters alike. The pipeline starts at `Action`: Intents, aiming and bindings are UI ([ui-architecture.md](ui-architecture.md)) and never enter the game. Scoped to today's game (hex movement, bump combat, abilities, potions, inventory); extension points are named, not built.

## Vocabulary

| Term | Meaning | Lives in |
|---|---|---|
| Actor | Something that takes turns: the player or a monster. | `ActorId` |
| Action | What an actor attempts this turn; data only. The pipeline's sole input. | `Action` |
| Rule | Per-Action-kind logic: check, cost, perform, or substitute. The only place situational logic lives. | `RULES` |
| Check | Precondition; failing it rejects the Action at no cost. | `Rule.check` |
| Rejection | Typed reason an Action did nothing. | `Rejection` |
| Substitution | A Rule replacing its Action with another, e.g. move into an occupant → attack. | `Outcome` |
| Cost | What performing spends: turn, AP, cooldown, an item. Data, not code. | `Cost` |
| Ability | Data-defined bindable Action payload: cost, aim, effects. Spells and potions alike. | `ABILITIES` |
| Effect | Primitive state change (damage, restore). One applier for every source. | `applyEffect` |
| Event | Authoritative record of one consequence. The pipeline's sole output. | `GameEvent` |
| Turn | One round: the player's Action, then each monster's, then upkeep. | `endTurn` |

Rename map from today: `Cast` + `Quaff` → `use` Action over an `AbilityId`; `SPELLS` + `POTIONS` → `ABILITIES`; `EFFECTS` (per-spell functions) → `Effect` data plus `applyEffect`; `strike`, `playerTurn`, `melee` → the `attack` Rule.

## Pipeline

```
UI ──────────→ Action ─resolve→ Rule ─┬─ rejected(reason)        → Event
                   ▲                   ├─ substituted(action) ──┐
                   └───────────────────┼────────────────────────┘
                                       └─ performed(cost) → Effects → Events
Monster Mind ─→ Action ─resolve→ (same)
```

Contracts:

- `act(game, action)` stays the only public entry. It resolves the player's Action; if it costs a turn, each monster's Mind chooses an Action, resolved by the same `resolve`; then upkeep (regeneration, spawning, sight) and `turn + 1`.
- Every Rule is reached through one exhaustive mapped table, so adding an Action kind without a Rule is a type error.
- Every state change records an Event with its actor. Frontends derive everything from Events and `Game`, never from re-deriving rules (e.g. "stepped onto a chest" is an Event, not a hex comparison in `session.ts`).
- Checks run before costs; costs are paid once, by `resolve`, from the Rule's declared `Cost`. Rules never call `endTurn`.
- Substitution is acyclic by construction (only `move` substitutes, only to non-substituting kinds); a test pins it.
- A rejected player Action spends nothing. A rejected monster Action is recorded and the monster loses its turn; Minds should only choose checked Actions.

## Types (sketch)

```ts
export type ActorId = "player" | Monster["id"];

export type Action =
  | { readonly kind: "move"; readonly actor: ActorId; readonly direction: Direction }
  | { readonly kind: "wait"; readonly actor: ActorId }
  | { readonly kind: "attack"; readonly actor: ActorId; readonly at: Hex }
  | { readonly kind: "use"; readonly actor: ActorId; readonly ability: AbilityId; readonly at?: Hex }
  | Transfer | Prepare | Destroy;

export interface Cost {
  readonly turn: boolean;
  readonly ap?: number;
  readonly cooldown?: number;
  readonly item?: PotionKind;
}

export type Outcome =
  | { readonly kind: "performed"; readonly game: Game; readonly cost: Cost }
  | { readonly kind: "substituted"; readonly action: Action }
  | { readonly kind: "rejected"; readonly reason: Rejection };

type Rule<A extends Action> = (game: Game, action: A) => Outcome;

const RULES: { readonly [K in Action["kind"]]: Rule<Extract<Action, { kind: K }>> };

export type Effect =
  | { readonly kind: "damage"; readonly amount: number; readonly area: Area }
  | { readonly kind: "restore"; readonly stat: "hp" | "ap"; readonly amount: number };

export interface Ability {
  readonly cost: Cost;
  readonly aim: Aim;
  readonly effects: readonly Effect[];
  readonly summary: string;
}
```

`Area` names the hexes an effect covers relative to actor and aim (`target`, `ahead`, `flanks`, `ring`), each with a damage fraction; cleave is `ahead` 1 + `flanks` 0.5, fireball `target` 1 + `ring` 0.25.

How today's actions map:

| Action | Rule | Cost |
|---|---|---|
| move, unfaced direction | turn to face | turn |
| move, faced, occupant ahead | substitute `attack` | (attack's) |
| move, faced, open | step; record `moved`, `steppedOnChest` | turn |
| attack | damage occupant (monster, spawner, player) | turn |
| use cleave / fireball / heal / strike | check aim; apply effects | turn, AP, cooldown |
| use potion | check item held; apply effects | item |
| transfer, destroy | as today | turn |
| prepare (UI rebinds a slot) | none | turn |

## Extension points

Named so later features land in one place; none built now (YAGNI).

- **Speed**: `Cost.turn: boolean` becomes an energy amount and the turn loop an energy scheduler. [Hauberk energy.dart; Nystrom-2014]
- **Reactions**: when one Event needs a second consequence (on-kill loot is inline today), add post-perform reaction rules keyed by Event kind. [Inform "After" rules; Qud-Events]
- **Replay**: seed + performed Actions reproduce a run; log them if a regression test needs it. [Fowler-ES]
- **Confirmation**: a Rule may later return an outcome asking the UI to confirm before performing.

## Prior art

What each contributes to the design above; not adopted wholesale.

- **Hauberk**: Action objects shared by hero and monsters; `ActionResult.alternative` substitutes (walk → attack, walk → open door); failed actions spend nothing; cost as a wrapping action. Source of `Outcome` and substitution. [Hauberk action.dart, walk.dart, game.dart]
- **Inform 7**: Check / Carry Out / Report separate validity, effect, and narration by name. Source of `check` before `perform`, and Events before prose. [Inform-Handbook]
- **Roguelike Tutorial in Rust**: intent as `WantsToMelee` / `WantsToDrinkPotion`, consumed once by one system, inserted identically by player input and monster AI. Same shape as a queued `Action` with `actor`. [Rust-Tutorial ch. 7, 9]
- **Brogue CE**: player and monsters reach the same `attack()` and `zap()`; one bolt table serves wands, staffs and monster spells. Source of one `ABILITIES` table and one `applyEffect` for all actors. Counterexample: `playerMoves` is ~400 imperative lines branching per situation, the shape `RULES` replaces. [Brogue-CE Combat.c, Items.c, Monsters.c, Movement.c]
- **Game Programming Patterns, Type Object**: `ABILITIES` is a type-object table; behaviour stays in a small closed set of `Effect` primitives rather than per-ability functions. [GPP-TypeObject]
- **ECS** (Bevy, Adam Martin): rejected. Pays off with many cross-cutting traits and parallel systems; here traits are tagged unions, turns are serial, and mutable component stores conflict with the pure reducer. [Bevy-ECS; T-Machine-1]
- **CQRS / event sourcing**: rejected as structure; the split already exists (`act` writes; `Session`, narration, draw read). Events-as-truth informs the Event contract. [Fowler-CQRS; Fowler-DE]

## Migration

Each step green on existing tests:

1. Tag every `Action` with `kind` and `actor`; add `resolve` with the mapped `RULES` table; Rules return `Outcome`; delete scattered `endTurn` calls.
2. `move` substitutes `attack`; delete `playerTurn`, `melee`.
3. `ABILITIES` + `Effect` + `applyEffect` replace `SPELLS`, `POTIONS`, `EFFECTS`, `Cast`, `Quaff`.
4. Monster Minds emit Actions through `resolve`; delete `strike`.
5. `steppedOnChest` Event replaces the chest check in `session.ts`.

## Sources

- Hauberk: `munificent/hauberk` @ `6c5c684`, `lib/src/engine/`. https://github.com/munificent/hauberk
- Brogue-CE: `tmewett/BrogueCE` @ `363440c`, `src/brogue/`. https://github.com/tmewett/BrogueCE
- Nystrom-2014: "A Turn-Based Game Loop". https://journal.stuffwithstuff.com/2014/07/15/a-turn-based-game-loop/
- Rust-Tutorial: https://bfnightly.bracketproductions.com/rustbook/chapter_7.html ; chapter_9.html
- Inform-Handbook: https://inform-7-handbook.readthedocs.io/en/v2.0/chapter_4_actions/action_processing/
- Qud-Events: https://wiki.cavesofqud.com/wiki/Modding:Events
- GPP-TypeObject: https://gameprogrammingpatterns.com/type-object.html
- Bevy-ECS: https://bevy.org/learn/quick-start/getting-started/ecs/
- T-Machine-1: http://t-machine.org/index.php/2007/09/03/entity-systems-are-the-future-of-mmog-development-part-1/
- Fowler-CQRS: https://martinfowler.com/bliki/CQRS.html ; Fowler-ES: https://martinfowler.com/eaaDev/EventSourcing.html ; Fowler-DE: https://martinfowler.com/eaaDev/DomainEvent.html
