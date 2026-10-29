# UI Architecture

Prior art researched at `706f1d4`; [Architecture](#architecture) is the implemented contract. Sources: [Sources](#sources).

Goal: the game (`src/game/`) is independent of the UI (`src/Pages/Game/`); the UI translates human input into `Action`s and renders `Game` and its events. UI owns input mode, bindings and keymap; game owns outcomes.

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

## Architecture

One-way flow, Elm-style [Elm-Architecture]: frontend → `Intent` → `update` (`src/Pages/Game/session.ts`) → `transition` (`src/Pages/Game/mode.ts`) → `Action` → `act` (`src/game/game.ts`) → `Game.events` → frontend.

- **Dependency direction**: the UI imports the game, never the reverse; `src/game/**` may not import `solid-js` or `Pages` (`eslint.config.js`). Game tests call `act` directly.
- **Session is the UI's state reducer.** `newSession(seed, range)` / `update(session, intent)` are pure; the Solid page holds it in a signal. The page owns the seed source, rendering, and locally persisted preferences (keymap, slot loadout). Invariants run once, in `update`: target re-tracked after every action, log bounded to `LOG_LENGTH`.
- **Mode is UI state, not game state** [Redux-FAQ]: `Mode = explore | aim`, exhaustive switches, `(mode, command, game, target) → { mode, action? }`. Cancel never yields an `Action`; confirm or re-pressing the aimed slot yields one `Cast`. Legality comes from the domain (`unreadinessOf`), as NetHack's `getpos` takes validity from its caller [NH-do_name.c].
- **Controls are the single input vocabulary**: `CONTROLS` (`src/Pages/Game/controls.ts`) names every remappable `Input`; keys resolve through a `Keymap` (`inputOf`, `rebound` swaps on conflict) and on-screen buttons press the same `Control.input`, so a button and its hotkey can't diverge. A slot `Input` resolves through the `Loadout` (`src/Pages/Game/loadout.ts`, `intentOf`) to a `use` intent. Pointer taps map to `move` directly.
- **Bindings are UI, rebinding is a turn**: the loadout lives in the page, persisted to `localStorage`; changing a slot dispatches the game's `prepare` action, which spends a turn and changes nothing else.
- **Target is orthogonal to mode**: lives on `Session`, so `cycleTarget` works while aiming.
- **`Action` is the sole game input** (Command pattern [GPP-Command]); `act` is the sole entry.
- **The game reports what happened as data**: `Game.events` holds the typed `GameEvent`s of the action that produced the state (cleared each `act`); rejected actions spend no turn and record `{ kind: "rejected", action, reason: Rejection }`. No prose in the domain; `narrationOf` (`src/Pages/Game/narration.ts`) renders events as log lines, always third person with the actor named ("The adventurer prepares themselves.", "The troll hits the adventurer.").
- **No event queue**: turn-based input-driven loop; events are returned synchronously, not dispatched [GPP-EventQueue, GPP-GameLoop].
- **Renderers read a snapshot**, never live getters.

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
