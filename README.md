# Hex RL

Personal starting point for SolidJS SPAs: classless semantic HTML styled by Pico, with Tailwind utilities for per-app exceptions.

## State

- Template: `Hex RL` and `hex-rl` placeholders are replaced when bootstrapping.
- [solidlib](https://github.com/SamuelDavis/solidlib) should track latest; update it when bootstrapping.
- `/game`: an infinite, seeded, 2.5D hex world to walk around: landform-driven heights in whole blocks, temperature and humidity biomes, rivers, lakes and trees. Generation is `src/game/terrain.ts` (continuous space; each hex samples it at its center, chunked on procgen's grid); movement rules are `src/game/explorer.ts`; `src/game/draw.ts` paints an oblique canvas view.
- `/styleguide` renders every styled element; check it after changing `src/pico.css`.

## Conventions

- World generation uses [procgen](../procgen); read `node_modules/procgen/README.md` before writing any worldgen code. `src/game/**` is linted with its determinism rules.

- Render into `document.body` so Pico's `body > header/main/footer` styles apply.
- `src/pico.css` is the app-agnostic classless layer: Pico, its theme, and its extensions. `src/index.css` holds per-app styles and Tailwind.
- Styling contracts and rationale: [docs/styling.md](docs/styling.md).
