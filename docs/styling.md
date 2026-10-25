# Styling

## Layers

Order is declared in `src/pico.css`.

- `src/pico.css` stays outside Tailwind's pipeline: Tailwind inlines imports into layers, where Pico's `@charset` is invalid.
- `icons` is lowest because Vite hoists the remote icon `@import` above the layer-order statement.
- `defaults` sits below `pico`: fallbacks that any Pico rule overrides.
- `theme` sits above `pico`: overrides win regardless of Pico's specificity or breakpoints.

## Theme

- Override `--pico-*`; don't replace Pico. Its components are the value, its density isn't. Values approximate the median of water.css, mvp.css, and simple.css.
- Root font size is fixed: below 16px, iOS zooms focused inputs.
- `pointer: coarse` raises controls to Apple's 44pt touch-target minimum.
- Pico's dialog-footer `margin-bottom: 0` loses to its own `[type=button]` margin on specificity; the `theme` layer restores it.

## `data-icon`

`HTMLIcon` is sized to the surrounding line height, including under Pico's `role="button"`.

## `data-cap`

Contract:

- `data-cap="start" | "end"` on a child makes its parent a row of any element type: caps shrink to content at that edge, the rest fills.
- A start cap comes first in DOM order. Non-cap content is one node; wrap mixed inline content.
- Don't cap direct children of `td`/`th`; the cell would stop being a table cell. Wrap the content instead.
- Inside `[role="group"]`, caps join form controls Pico-style; elsewhere they are spaced.
- A row owns its vertical spacing: its children's block margins are zeroed. Pico-spaced rows keep Pico's margin; others get typography spacing.
- Clickable `HTMLIcon` caps are squares spanning the row's height.
- Padded containers set `--cap-offset` (block minus inline padding) so caps get equal insets. `article > :is(header, footer)` mirrors Pico's sectioning padding formula; update it with Pico.

Rationale:

- Opt-in rather than inferred from structure: structural triggers misfire on `p`, `td`, and `summary`.
- The value sets the side because CSS can't see text nodes.
- Grid, not flex: flex stretch doesn't give `aspect-ratio` a definite cross size.
- `contain: inline-size`: ligature text would widen icons until the icon font loads.
