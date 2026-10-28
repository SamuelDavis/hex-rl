# Monster AI

Research snapshot at `9c9dbfd` (refactor: `src/game/mind.ts`). Sources: [Sources](#sources).

## Models

- FSM: fixed states, one current state, hardcoded transitions. Suited to entities whose behaviour switches among few discrete states driven by events over time. [GPP-State §"So How Useful Are They?"]
- Enter/exit actions attach to transitions, not states; state objects are a pattern for FSMs with per-state data/behaviour. [GPP-State §"State Pattern", §"Enter and Exit Actions"]
- Pushdown automaton: stack of states; push interrupt, pop back to prior state. Used when an interrupt must return to what was interrupted. [GPP-State §"Pushdown Automata"]
- HFSM: superstate groups substates; transitions out of a superstate apply to all substates; state chain walked top-down for shared behaviour. [GPP-State §"Hierarchical State Machines"; Harel-1987]
- Concurrent state machines: independent machines for independent aspects of one entity. [GPP-State §"Concurrent State Machines"]
- Statecharts: extend state diagrams with hierarchy, concurrency (orthogonality), broadcast communication. [Harel-1987]
- Behavior trees: tree of nodes ticked each cycle returning success/failure/running; running nodes persist across ticks without storing state in a flat machine. [Simpson-2014]
- Halo 2 AI: hierarchical FSM / behaviour DAG; prioritized child list, first runnable child runs, higher-priority siblings interrupt on later ticks; relevancy binary; a behaviour may appear under several parents. [Isla-2005]
- GPP positions FSMs as a poor fit for complex game AI; behaviour trees and planning are its suggested next step. [GPP-State §"What's the Catch?", §"So How Useful Are They?"]

## Shipping roguelikes

### Brogue CE

- Monster state is an enum: sleeping, tracking scent, wandering, fleeing, ally. [Brogue-Rogue.h:2184-2189]
- Orthogonal `creatureMode` enum (`MODE_NORMAL`, `MODE_PERM_FLEEING`) forces fleeing from wander/track without a separate state. [Brogue-Rogue.h:2192-2193; Brogue-Monsters.c:1738-1740]
- Perception is a predicate separate from transitions: `awarenessDistance` (Monsters.c:1623), `awareOfTarget` (Monsters.c:1651). Noticing is a per-turn chance (`rand_percent(25)`); tracking monsters lose the player with `rand_percent(97)` outside stealth range and hard-drop beyond 3x. [Brogue-Monsters.c:1651-1686]
- All transitions live in one function, `updateMonsterState` (Monsters.c:1711): ordered `if/else if` chain, called from `monstersTurn` before acting (Monsters.c:3364-3365).
- Sleeping monsters: waking costs their whole turn (Monsters.c:3357-3359).
- Per-creature scheduling: `ticksUntilTurn` set from `movementSpeed` (Monsters.c:3352); turn cost, not global turn count, governs cadence.

### NetHack 3.6

- Fleeing is a flag plus timer, orthogonal to other behaviour: `mflee`, `mfleetim` (monmove.c:267-308 `monflee`; mon.c:712-713 timeout).
- Fear triggered per turn by `distfleeck` (monmove.c:315-346): scared monsters flee for `rnd(rn2(7) ? 10 : 100)` turns.
- Fleeing monsters may regain courage at random when at full hp and no timer (monmove.c:436-438).
- Movement by speed budget: `mcalcmove` (mon.c:639) converts speed to movement points per turn.
- Source self-assessment: "The whole dochugw/m_move/distfleeck/mfndpos section is serious spaghetti" (monmove.c:365).

### DCSS

- Behaviour enum (`BEH_SEEK`, `BEH_WANDER`, `BEH_FLEE`, `BEH_RETREAT`, …) with per-behaviour `switch` cases in `handle_behaviour` (mon-behv.cc:288; cases at 554, 741, 840, 853). Transitions computed as `new_beh` within each case.
- Event-driven transitions: `behaviour_event` (mon-behv.cc:1063) sets `BEH_FLEE` on fear/hit events, outside the per-tick path.
- Flee exit depends on current scared status: `if (!isScared) new_beh = BEH_SEEK;` (mon-behv.cc:853-856; `isScared` from `ENCH_FEAR`, line 324).
- Intelligence-dependent timers: forgetting the foe is `one_chance_in(isSmart ? 60 : 20)` (mon-behv.cc:825; `isSmart` at line 323).

## Patterns applied to monster AI

- Pure transition functions: `(state, perception) → state`, unit-testable without the game loop. Brogue and DCSS both separate perception from transitions; hexrl does too (`canNotice`, `src/game/sight.ts:51`).
- Enter actions as constructors: a state is created with its entry data (anchor, lastSeen, counters). GPP recommends attaching entry data at transition time. [GPP-State §"Enter and Exit Actions"]
- Exhaustive `switch` over a discriminated union catches new states at compile time. [GPP-State §"Enums and Switches"; hexrl `src/game/mind.ts`]
- Turn cadence: per-monster timers (counting the monster's own turns) remain correct under varied speed. [Brogue-Monsters.c:3352; NetHack-mon.c:639]
- Determinism: stochastic choices seeded per monster and turn. Deterministic counters are a valid alternative to Brogue's per-turn probability.

## Sources

- GPP-State: Robert Nystrom, "Game Programming Patterns", chapter "State". https://gameprogrammingpatterns.com/state.html ; markdown source https://github.com/munificent/game-programming-patterns/blob/master/book/state.markdown (line refs to section headings).
- Harel-1987: David Harel, "Statecharts: A visual formalism for complex systems", Science of Computer Programming 8(3), 1987. DOI 10.1016/0167-6423(87)90035-9. Abstract not verified verbatim; hierarchy/concurrency/broadcast content paraphrased from secondary confirmation. Re-verify before quoting.
- Isla-2005: Damian Isla, "GDC 2005 Proceeding: Handling Complexity in the Halo 2 AI", Game Developer, 2005-03-11. https://gamedeveloper.com/programming/gdc-2005-proceeding-handling-complexity-in-the-i-halo-2-i-ai . Content verified via fetch summary, not by reading the original page directly.
- Simpson-2014: Chris Simpson, "Behavior trees for AI: How they work", Game Developer, 2014-07-18. https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work
- Brogue-*: Brogue CE, `src/brogue/Rogue.h` and `src/brogue/Monsters.c`, branch `master` as of 2026-10-27. https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Monsters.c
- NetHack-*: NetHack 3.6, `src/monmove.c`, `src/mon.c`, branch `NetHack-3.6`. https://github.com/NetHack/NetHack/blob/NetHack-3.6/src/monmove.c
- DCSS: Crawl, `crawl-ref/source/mon-behv.cc`, branch `master` as of 2026-10-27. https://github.com/crawl/crawl/blob/master/crawl-ref/source/mon-behv.cc

## Implications for hexrl

Current design (`src/game/mind.ts`, `src/game/game.ts`): `Mind = Idle | Hostile | Hunting`, pure `sighted`/`unsighted` transitions, exhaustive `switch` in `behave`. This already matches the FSM recommendations. Remaining gaps and recommendations:

- Keep the FSM. Three states with timers and leash does not justify behaviour trees; GPP and Isla both target larger behaviour sets with prioritized interrupts. Revisit at roughly six or more behaviours or when priority interrupts appear.
- Put leash-centre policy in `mind.ts`. `leashOf` (`game.ts:498`) branches on `mind.state === "idle"`. Move it next to `IDLE`/`sighted` so all state-dependent location policy lives in one module.
- Make action order explicit. `monsterTurn` (`game.ts:596`) strikes adjacent players before `mindOf` runs, so an unaware idle monster that is adjacent still attacks. Brogue updates state before acting (Monsters.c:3364-3365). Either document this contact rule in a test or move `mindOf` ahead of the strike check.
- Fix `monstersTurn` (`game.ts:606`). It looks up each monster by `id` with `find` (O(n²)) on every step. Iterate ids of the snapshot and read live state, or index into the array. Behaviour is unchanged.
- Add per-kind timers only when a second kind needs them. `TRACK_TURNS`/`HUNT_TURNS` are global (`mind.ts:3-4`). DCSS varies forgetting by intelligence (mon-behv.cc:825). If needed, move these into `MONSTERS` data in `src/game/monsters.ts` alongside `gold` and `hp`.
- Flee, if added, is an orthogonal flag, not a fourth `Mind` variant. NetHack and Brogue both do this (`mflee`+`mfleetim`; `MODE_PERM_FLEEING`). A flag avoids duplicating hostile/hunting transitions per fleeing variant.
- Sleep, if added: waking takes the monster's turn (Brogue Monsters.c:3357-3359). Add it as an idle sub-state with a noticing chance, not a new top-level behaviour.
- Interrupt-and-resume (e.g. flee then return to hunting) would need a stack (GPP pushdown). Not needed now; avoid until an interrupt exists (YAGNI).
- Keep transitions deterministic. Current counters satisfy the seeded-determinism rule in `src/game/**`. If a probabilistic transition is added, draw from `rngOf(seed, ...).child(id)` keyed by turn, as `wander` does (`game.ts`), not `Math.random`.
- Keep table tests on `unsighted`/`sighted` (`src/game/mind.test.ts`). Brogue's single monolithic transition function is the cautionary example (NetHack's "serious spaghetti" comment). Add tests for each new transition before extending the chain.
- Monster timers already count per monster turn (inside `monsterTurn`). If speed is added, keep that: give each monster its own tick accumulator (Brogue `ticksUntilTurn`, NetHack `mcalcmove`) rather than changing global `turn` semantics.

## Unresolved

- Isla-2005 and Harel-1987 quotes were not verified against the original documents (see Sources).
- Whether hexrl should make adjacency attacks an explicit rule or a state transition is a design choice, not settled by sources.
