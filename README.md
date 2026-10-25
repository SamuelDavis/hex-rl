# Hex RL

Personal starting point for SolidJS SPAs: classless semantic HTML styled by Pico, with Tailwind utilities for per-app exceptions.

## State

- Template: `Hex RL` and `hex-rl` placeholders are replaced when bootstrapping.
- [solidlib](https://github.com/SamuelDavis/solidlib) should track latest; update it when bootstrapping.
- `/styleguide` renders every styled element; check it after changing `src/pico.css`.

## Conventions

- Render into `document.body` so Pico's `body > header/main/footer` styles apply.
- `src/pico.css` is the app-agnostic classless layer: Pico, its theme, and its extensions. `src/index.css` holds per-app styles and Tailwind.
- Styling contracts and rationale: [docs/styling.md](docs/styling.md).
