# Hex RL

Personal starting point for SolidJS SPAs: classless semantic HTML styled by Pico, with Tailwind utilities for per-app exceptions.

## State

- Template: `Hex RL` and `hex-rl` placeholders are replaced when bootstrapping.
- [solidlib](https://github.com/SamuelDavis/solidlib) should track latest; update it when bootstrapping.
- `/game`: a roguelike in an infinite, seeded, 2.5D hex world: landform-driven heights in whole blocks, temperature and humidity biomes (low, humid ground becomes pool-dotted marsh), rivers, lakes and trees, with directional line of sight (a cone toward the way faced; any direction input turns, repeating it steps, plus close all-round awareness), monsters that see the same way, wear a facing chevron and a ring that is red while hostile and amber while hunting, and can be targeted (`src/Pages/Game/target.ts`: monsters in view and on screen, nearest first; the target shows what it sees, or a `?` where it was last seen), bump combat, and spells (`src/game/spells.ts`: mana cost, cooldown, aim; cast from six hotkeyed slots, bound in the Slots tab (spends a turn), hex-aimed ones via a reticle, `src/Pages/Game/aim.ts`); slain monsters may drop a chest of gold, potions and gear (odds per kind in `src/game/monsters.ts`; items, names, sizes and pack capacity in `src/game/items.ts`); stepping onto a chest opens the inventory: a collapsed paper doll, then pack, then chest, stacked lists whose arrows move an item to the list above or below (a pack item's up arrow equips it, `placeFor` in `src/game/items.ts`), each move a turn; potions bound to slots are drunk without spending a turn. Generation is `src/game/terrain.ts` (continuous space; each hex samples it at its center, chunked on procgen's grid), including monster spawners (dens, camps, villages, mines, caves) sited by biome habitat, nearby fresh water and distance from spawn. Spawner behaviour (monster pool, boss, cap, leash radius, interval, per-turn chance, hit points derived from its pool) is data in `src/game/monsters.ts`. Live monsters are game state (`src/game/game.ts`): spawned beside active spawners (none while hemmed in; spawners block everyone), each with a `Mind` (`src/game/mind.ts`, a pure state machine; behaviour per state in `game.ts`): idle (wandering within its spawner's leash, walking back when drawn away), hostile (seeking the player's last known hex) or hunting (wandering around it for `HUNT_TURNS`, biased by the player's heading). Engaged monsters are leashed to an anchor, where they stood idle when they found the player. Monsters far away are forgotten. Spawners are permanent: bumped down to 0 hit points they are wrecked, unleashing a hostile boss (stronger and richer than their pool; held back until a hex beside them is free), heal over time, and once whole spawn one monster at once and restart their timer. The `/game` page (`src/Pages/Game/`, UI only; `src/game/` never imports it) drives a pure `Session` (`src/Pages/Game/session.ts`): intents in, typed game events out, aiming as a UI mode (`src/Pages/Game/mode.ts`), prose from `src/Pages/Game/narration.ts`. Every key is remappable (`src/Pages/Game/controls.ts`, Other → Controls); buttons show their hotkey. Sight is `src/game/sight.ts`, movement `src/game/explorer.ts`, and `src/Pages/Game/draw.ts` paints an oblique canvas view.
- `/styleguide` renders every styled element; check it after changing `src/pico.css`.

## Conventions

- World generation uses [procgen](../procgen); read `node_modules/procgen/README.md` before writing any worldgen code. `src/game/**` is linted with its determinism rules.

- Render into `document.body` so Pico's `body > header/main/footer` styles apply.
- `src/pico.css` is the app-agnostic classless layer: Pico, its theme, and its extensions. `src/index.css` holds per-app styles and Tailwind.
- Styling contracts and rationale: [docs/styling.md](docs/styling.md).
- Monster AI state machines, prior art, and refactor recommendations: [docs/monster-ai.md](docs/monster-ai.md).
- UI/game separation contract (session, modes, events) and prior art: [docs/ui-architecture.md](docs/ui-architecture.md).
- Inventory, loot, and paper-doll equipment decisions and prior art: [docs/inventory.md](docs/inventory.md).
- Intent → action → consequence pipeline, glossary, CQRS/ECS comparison and prior art: [docs/action-pipeline.md](docs/action-pipeline.md).
