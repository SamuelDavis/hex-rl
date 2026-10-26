# Hex RL

Personal starting point for SolidJS SPAs: classless semantic HTML styled by Pico, with Tailwind utilities for per-app exceptions.

## State

- Template: `Hex RL` and `hex-rl` placeholders are replaced when bootstrapping.
- [solidlib](https://github.com/SamuelDavis/solidlib) should track latest; update it when bootstrapping.
- `/game`: a roguelike in an infinite, seeded, 2.5D hex world: landform-driven heights in whole blocks, temperature and humidity biomes, rivers, lakes and trees, with directional line of sight (a cone toward the way faced; any direction input turns, repeating it steps, plus close all-round awareness), monsters that see the same way and wear a facing chevron, and bump combat. Generation is `src/game/terrain.ts` (continuous space; each hex samples it at its center, chunked on procgen's grid), including monster lairs. Live monsters are game state (`src/game/game.ts`): woken near the player, forgotten far away, and slain lairs recorded by hex so they stay dead. Sight is `src/game/sight.ts`, movement `src/game/explorer.ts`, and `src/game/draw.ts` paints an oblique canvas view.
- `/styleguide` renders every styled element; check it after changing `src/pico.css`.

## Conventions

- World generation uses [procgen](../procgen); read `node_modules/procgen/README.md` before writing any worldgen code. `src/game/**` is linted with its determinism rules.

- Render into `document.body` so Pico's `body > header/main/footer` styles apply.
- `src/pico.css` is the app-agnostic classless layer: Pico, its theme, and its extensions. `src/index.css` holds per-app styles and Tailwind.
- Styling contracts and rationale: [docs/styling.md](docs/styling.md).
