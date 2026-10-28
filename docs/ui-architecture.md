# UI Architecture

Research snapshot at `706f1d4` (refactor: monsters perceive before acting). Sources: [Sources](#sources).

Goal: game advances identically under tests, GUI (`src/Pages/Game.tsx`), or TUI. UI owns input mode; game owns outcomes.

## Prior art

- Command object as the sole mutation entry: input is reified as data, `execute(actor)`, storable, queueable, replayable. [GPP-Command §"Directions for Actors", §"Undo and Redo"]
- Input is a port: NetHack's `struct window_procs` (`include/winprocs.h`) holds function pointers (`win_nh_poskey`, `win_print_glyph`, `win_raw_print`) that each UI fills. [NH-winprocs.h]
- Position selection takes a validity callback from the caller: `getpos_getvalid` / `getpos_hilitefunc` are set by the caller, and `getpos()` calls `nh_poskey` directly. The domain says what is legal; the port says how a key arrives. [NH-do_name.c:~42-45, ~556, ~600, ~340]
- DCSS `direction()` takes an args struct (`restricts`, `mode`, `range`, `needs_path`, `hitfunc`, `get_desc_func`, ...) and reads world state directly; not isolated from game state. Useful as a contrast. [DCSS-directn.cc, `direction`, `direction_chooser_args`]
- Brogue CE `travel` writes `rogue.cursorLoc` and calls `displayRoute`/`message` directly. Display and cursor logic are interleaved with game code. [Brogue-Movement.c ~1225, ~1610; summary-derived, verify before quoting]
- Game loop: input is processed without blocking, then the simulation advances. Event-blocking loops are called a problem for real-time games. Turn-based hexrl is input-driven by design, so blocking on input is acceptable. [GPP-GameLoop §"Event loops", §"Design Decisions"]
- Event queue decouples when a message is handled from when it is sent; receiver may see a changed world; a central queue is a global. Needed only if timing must be decoupled, which turn-based hexrl does not need. [GPP-EventQueue §"Intent", §"Keep in Mind"]
- Redux guidance: state used by one component stays local (`isDropdownOpen` example); state shared or derived belongs in the store. Maps to: aim/target are UI-only, but target validity depends on game state. [Redux-FAQ §"Do I have to put all my state into Redux?"]
- Elm: Model, Update, View; program receives messages and renders state. Only Update changing state was not confirmed. [Elm-Architecture]

## Current tangles (hexrl)

- UI signal holds domain + UI mode together: `explore()` bundles `game`, `target`, `aiming` (`src/Pages/Game.tsx:93-98`).
- `perform` sequences domain and UI in one setter: `act`, then `tracked` for the target invariant, then clears `aiming` (`Game.tsx:138-144`). Any caller that forgets `tracked` breaks the target invariant.
- Slot logic decides mode in the view: whether to enter aim mode checks `unreadyReasonOf` (exported domain fn, `src/game/game.ts:422`) and `aim.kind` (`Game.tsx:162-175`). Re-deriving domain rules in UI.
- Slot re-press confirm lives in the view: `if (aiming?.spell === spell) return castAimed()` (`Game.tsx:166`).
- Key routing branches on mode in the view: `handleKey` (`Game.tsx:193-205`); `KEYS` is gated by `!isAiming`, but `TARGET_KEY` is not, so `t` cycles targets during aim (`Game.tsx:198`). Mode rules are implicit.
- Domain emits prose: `aimProblemOf` returns English (`game.ts:403-420`); `castSpell` appends it to the log (`game.ts:437`).
- No outcome from `act`: a blocked move returns the same `game` object (`game.ts:654`); a rejected cast returns a log-appended `game` (`game.ts:437`). Caller infers accepted-or-not from `turn`.
- Log is the only event channel: `logged` appends strings (`game.ts:125-128`); `act` consumers can't branch on what happened (kill, wreck, cast, reject).
- Renderer reads a global, not its input: `isWrecked: (spawner) => isWrecked(getGame(), spawner)` (`Game.tsx:243`).
- Seed chosen in UI: `randomSeed()` (`Game.tsx:91`). Fine for the GUI; a headless driver must inject the seed.
- Already clean: `act(game, action)` is the single domain entry (`game.ts:646`); `Action` is a closed union (`game.ts:99`); `target.ts` selection is pure over `Game` (`target.ts:37-59`); `aim.ts` is pure (`aim.ts:7-25`); `spells.ts` is data with an `aim` discriminant (`spells.ts:3-46`); cooldown is state (`game.ts:57`, `103-104`, `440-446`); tests drive `act` directly (39 call sites, `src/game/game.test.ts`).

## Recommended model

Two layers, one-way dependency: UI → (intent) → pure mode reducer → (Action) → `act` → (outcome) → renderer.

- Mode is a discriminated union, UI-owned, pure: `Explore { target? } | Aim { spell, range, at, target? }`. Transitions are `(mode, intent, game) → { mode, action? }`. Exhaustive `switch` on `mode.kind`, as in `mind.ts`.
- Intents are UI-neutral: `move(direction)`, `slot(n)`, `cycleTarget`, `confirm`, `cancel`, `wait`. Keyboard, pointer (`onTap`, `Game.tsx:207`), and TUI keys map to these in the adapter only.
- Cancel never emits an `Action` (no turn spent). Confirm emits one `Cast`. Explicit `Aim → Explore` edges replace the implicit clear in `perform`.
- `act` returns `{ game, events }` where events are typed: `{ kind: "cast", spell }`, `{ kind: "rejected", reason }` with `reason` a union (`"cooldown" | "mana" | "no-target" | "out-of-reach" | "out-of-range" | "out-of-sight"`), `{ kind: "killed", kind }`, etc. Prose moves to the UI from `reason`.
- A headless `Session` (`newSession(seed)`, `dispatch(intent)`, `snapshot()`) owns `game + mode`, runs `tracked` after every accepted action, and is what tests, the Solid page, and a TUI all call. Single place for the target invariant. `testing.ts` fixtures stay for domain tests.
- Renderer takes a snapshot: `(game, mode)`. No `getGame()` closures.
- Seed injected into `newSession`; `randomSeed` stays in the page.

## Mapping to this codebase

- `src/game/game.ts`: return outcome from `act` (`:646-656`); replace `aimProblemOf` / `unreadyReasonOf` strings with `RejectReason` (`:403-437`); keep `cooldownOf`/`unreadyReasonOf` as the single rule source and make the UI consume the reason, not re-check it. Keep `logged`/`log` only if a log view remains; derive it from events in the adapter.
- `src/game/target.ts`: unchanged; already pure. Its `tracked` call moves from `Game.tsx:141` into `Session`.
- `src/game/aim.ts`: unchanged, or folded into the new `Aim` transitions (`startAim` on slot press, `aimed` on move). Keep it pure.
- New `src/game/mode.ts` (or `src/game/input.ts`): `Mode` union and `(mode, intent, game)` transition. Lift `Aiming` (`Game.tsx:69-73`) and the slot/key rules (`Game.tsx:162-205`) here.
- `src/Pages/Game.tsx`: keep signals, canvas, DOM. Delete `explore`'s mixed state (`:93-98`), `perform`/`steer`/`castSlot` logic (`:138-175`), and `handleKey` branching (`:193-205`). Reads go through a snapshot.
- `src/game/draw.ts`: takes snapshot data only (already takes most of it).
- Tests: table tests on `mode.ts` transitions (Red/Green, pure); `Session` tests for "target cleared when out of range after accepted action"; keep `game.test.ts` on `act` for domain rules.
- Monster-side issue in `game.ts:611-619` (O(n²) `find`) is already in [monster-ai.md](monster-ai.md); not a UI concern.

## Sources

- GPP-Command: Robert Nystrom, "Command", Game Programming Patterns. https://gameprogrammingpatterns.com/command.html (fetched; sections quoted by heading).
- GPP-GameLoop: Robert Nystrom, "Game Loop". https://gameprogrammingpatterns.com/game-loop.html (fetched).
- GPP-EventQueue: Robert Nystrom, "Event Queue". https://gameprogrammingpatterns.com/event-queue.html (fetched).
- NH-winprocs.h: NetHack 3.6, `include/winprocs.h`, `struct window_procs`. https://github.com/NetHack/NetHack/blob/NetHack-3.6/include/winprocs.h (fetched via raw; no line numbers recovered).
- NH-do_name.c: NetHack 3.6, `src/do_name.c`, `getpos()`. https://github.com/NetHack/NetHack/blob/NetHack-3.6/src/do_name.c (fetched; line numbers approximate, from a non-numbered paste).
- DCSS-directn.cc: Crawl `master`, `crawl-ref/source/directn.cc`, `direction()`, `direction_chooser`. https://github.com/crawl/crawl/blob/master/crawl-ref/source/directn.cc (fetched; first ~100k chars only, summary-derived).
- Brogue-Movement.c: BrogueCE `master`, `src/brogue/Movement.c`. https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Movement.c (summary-derived).
- Redux-FAQ: Redux docs, "Do I have to put all my state into Redux?", "Should I put form state or other UI state in my store?". https://redux.js.org/faq/organizing-state (fetched).
- Elm-Architecture: Elm guide, "The Elm Architecture". https://guide.elm-lang.org/architecture/ (fetched).

Not used (fetch failed or content absent): Harel-1987 PDF (fetch error; prior citation in monster-ai.md unverified); XState statecharts guide (404); Gary Bernhardt "Boundaries" (no content for the functional-core claim); Kyzrati/Cogmind input posts (mirror fetch failed; search snippet only, no claims cited); Brogue `chooseTarget` (not found in `Items.c` first 200k chars; location unknown).

## Unresolved

- Brogue's targeting cursor location and whether it calls display directly. Need a targeted fetch of the full `Items.c` or a grep of `chooseTarget` in BrogueCE.
- Cogmind's "domains" for command contexts (REX engine). Primary text not retrieved.
- Whether a TUI is planned. If not, `Session` may be YAGNI; the mode union and outcome type still pay off for tests.
- Whether `log` stays in `Game` (domain-visible) or moves to events. Depends on whether a log view needs to replay past messages.
