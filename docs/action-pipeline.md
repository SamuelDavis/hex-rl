# Action Pipeline

Contract for turning any actor's choice into authoritative game events. One vocabulary, one execution path, for the player and monsters alike. The pipeline starts at the game's `Intent`: UI messages, aiming and bindings are UI ([ui-architecture.md](ui-architecture.md)) and never enter the game. Scoped to today's game (hex movement, bump combat, abilities, potions, inventory); extension points are named, not built.

## Vocabulary

| Term | Meaning | In code (`src/game/`) |
|---|---|---|
| Actor | Takes turns: the player or a monster. | `ActorId` (`PLAYER` or monster id); `ActorKind` names it in events |
| Intent | What an actor wants: a Deed, or `move` (go a direction). The pipeline's sole input. | `Intent` |
| Deed | Something a Rule can perform, dispatchable alone: `turn`, `step`, `attack`, `wait`, `use`, ... | `Deed` |
| Rule | One Deed's checks and effects; knows no other Deed. | `RULES`, `Rule` |
| Outcome | A Rule's verdict: performed (and whether a turn passes) or rejected. | `Outcome` |
| Rejection | Typed reason a Deed did nothing. | `Rejection` |
| Plan | The actor's decision tree for an Intent: a Deed to attempt, and per rejection reason the Plan to try next. | `Plan`, `planOf` |
| Policy | How an actor turns an Intent into a Plan. Situational choice lives here, per actor, not in Rules. | `bold` |
| Ability | Data row: MP, cooldown, whether it spends a turn, item consumed, aim, effects. Spells and potions alike. | `ABILITIES`, `abilities.ts` |
| Effect | Primitive state change: face, damage over an `Area`, restore. One applier. | `Effect`, `applied` |
| Event | Authoritative record of one consequence. The pipeline's sole output. | `GameEvent` |
| Turn | The player's Action, then each monster's, then upkeep. | `endTurn` |

## Contract

```
Intent ─planOf(actor)→ Plan ─attempted→ Rule ─┬─ performed → Events; the player's: endTurn if it spends a turn
                         ▲                     └─ rejected(reason) → Plan.otherwise[reason]?
                         └──────────────────────────────── yes ───────┘   no → `rejected` Event, nothing spent
```

- `act(game, intent)` is the only entry; the UI only ever sends the player's Intent. `endTurn` runs each monster's Intent through the same `settled`.
- `RULES` is a mapped type over `Deed["kind"]`: a Deed without a Rule, or a narration verb or rejection reason without text, is a type error.
- Rules are isolated: `turn` only faces, `step` only moves the way faced (rejecting `not-facing`, `blocked`, `occupied`), `attack` only hits a faced, adjacent foe. Combined behaviours are Abilities (strike faces and attacks in one turn).
- Alternatives belong to the actor, not to Deeds or the pipeline: `planOf` builds the actor's Plan; `attempted` walks it generically and knows no Deed. A Plan is a finite tree value, so walking it always ends. A Deed alone is a one-node Plan. [Behavior-tree fallback node; contrast Hauberk, where the Action returns its alternate: [hauberk-actions.md](hauberk-actions.md)]
- Today every actor's `move` uses the `bold` policy: `step`; on `not-facing`, `turn`; on `occupied`, `attack` that hex. A kind that won't attack when blocked is a policy without the `occupied` branch.
- One rule set for every actor. Monster Minds choose Intents (`move` toward a goal, or `wait`), as the player does.
- A rejected Plan spends nothing, for any actor; it records one `rejected` Event naming the last Deed attempted and its reason. A monster decides once per world turn, so a rejected Plan leaves it idle that turn.
- Every consequence is an Event naming its actor (`turned`, `stepped`, `rejected`, ...). The UI derives state from Events (`stepped` onto a chest opens the inventory), never by re-deriving rules. Every Event is logged.
- `use` pays its Ability's costs (MP, cooldown, item) itself; only it has costs beyond the turn.
- Player-only for now: `use`, `transfer`, `prepare`, `destroy` act on the player's resources. Foes: the player attacks monsters and spawners; monsters attack only the player.

## Extension points

Named so later features land in one place; none built now (YAGNI).

- **Speed**: `spendsTurn: boolean` becomes an energy amount and the turn loop an energy scheduler. [Hauberk energy.dart; Nystrom-2014]
- **Reactions**: when one Event needs a second consequence (on-kill loot is inline today), add post-perform reaction rules keyed by Event kind. [Inform "After" rules; Qud-Events]
- **Replay**: seed + performed Actions reproduce a run; log them if a regression test needs it. [Fowler-ES]
- **Confirmation**: a Rule may later return an outcome asking the UI to confirm before performing.

## Prior art

What each contributes to the design above; not adopted wholesale.

- **Hauberk**: Action objects shared by hero and monsters; `ActionResult.alternative` substitutes (walk → attack, walk → open door); failed actions spend nothing; cost as a wrapping action. Contrast: the alternate is chosen by the Action there, by the actor's Plan here. [Hauberk action.dart, walk.dart, game.dart]
- **Inform 7**: Check / Carry Out / Report separate validity, effect, and narration by name. Source of `check` before `perform`, and Events before prose. [Inform-Handbook]
- **Roguelike Tutorial in Rust**: intent as `WantsToMelee` / `WantsToDrinkPotion`, consumed once by one system, inserted identically by player input and monster AI. Same shape as a queued `Action` with `actor`. [Rust-Tutorial ch. 7, 9]
- **Brogue CE**: player and monsters reach the same `attack()` and `zap()`; one bolt table serves wands, staffs and monster spells. Source of one `ABILITIES` table and one `applyEffect` for all actors. Counterexample: `playerMoves` is ~400 imperative lines branching per situation, the shape isolated `RULES` plus per-actor Plans replace. [Brogue-CE Combat.c, Items.c, Monsters.c, Movement.c]
- **Game Programming Patterns, Type Object**: `ABILITIES` is a type-object table; behaviour stays in a small closed set of `Effect` primitives rather than per-ability functions. [GPP-TypeObject]
- **ECS** (Bevy, Adam Martin): rejected. Pays off with many cross-cutting traits and parallel systems; here traits are tagged unions, turns are serial, and mutable component stores conflict with the pure reducer. [Bevy-ECS; T-Machine-1]
- **CQRS / event sourcing**: rejected as structure; the split already exists (`act` writes; `Session`, narration, draw read). Events-as-truth informs the Event contract. [Fowler-CQRS; Fowler-DE]

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
