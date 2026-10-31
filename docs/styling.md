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
- Pico pads `[role="group"]` buttons `2rem` inline, so groups of four or more overflow phone widths; the `theme` layer makes them inherit the theme's form spacing.
- One gap between controls: `--pico-spacing`. Pico spaces buttons only by inter-element whitespace, which JSX strips, so the `theme` layer lays dialog footers out as a wrapping flex row with that gap (dropping Pico's footer button margins, whose `margin-bottom: 0` also loses to its own `[type=button]` margin, and its full-width `button[type=submit]`). Other button rows wrap in `flex flex-wrap gap-(--pico-spacing)`, as button grids use `gap-(--pico-spacing)`.

## App themes

- A theme is a `ThemeId` (`src/theme.ts`), set as `data-app-theme` on `<html>`. Page styles key on the attribute; the canvas looks up `CANVAS_THEMES[id]`. `Record<ThemeId, …>` makes a new theme a compile error until it has a canvas implementation.
- `classic` is Pico's own look: it adds no page styles.
- `woodcut` (ink, bone and blood on paper; IM Fell English, loaded in `index.html`) overrides `--pico-*` in `src/index.css`'s `theme` layer. Colors are `light-dark()` pairs, so one declaration serves Pico's light, dark and `data-theme` cases; Lightning CSS polyfills it from Pico's `color-scheme` rules. Its canvas ignores the color scheme: unexplored ground is ink, as an uncarved block prints.
- Per-theme values Tailwind classes need are custom properties (e.g. `--mana-color`).

## Dropdown

`details.dropdown` is vendored into `src/pico.css`'s `pico` layer from Pico's class-based build, which the classless build omits; re-copy it when upgrading Pico. Its `--pico-dropdown-*` colors derive from theme variables in `defaults`, so app themes restyle it. In `ul[dir="rtl"]` (right-aligned), give items `dir="ltr"` so trailing punctuation keeps its place.

## `data-icon`

`HTMLIcon` is sized to the surrounding line height, including under Pico's `role="button"`.

## `data-cap`

Contract:

- `data-cap="start" | "end"` on a child makes its parent a row of any element type: caps shrink to content at that edge, the rest fills.
- A start cap comes first in DOM order. Non-cap content is one node; wrap mixed inline content.
- Don't cap direct children of `td`/`th`; the cell would stop being a table cell. Wrap the content instead.
- Inside `[role="group"]`, caps join form controls Pico-style; elsewhere they are spaced.
- A row owns its vertical spacing: its children's block margins are zeroed. Pico-spaced rows keep Pico's margin; others get typography spacing.
- Clickable `HTMLIcon` caps are squares spanning the row's height, except in `li`, where they are one line tall and top-aligned: list text wraps, and a stretched cap outgrows its `contain: inline-size` track.
- A `ul` with any cap row drops markers on every `li` and its marker indent: cap rows are grids, which lose markers, so mixed lists would be ragged, and the indent would only take width from the caps.
- Padded containers set `--cap-offset` (block minus inline padding) so caps get equal insets. `article > :is(header, footer)` mirrors Pico's sectioning padding formula; update it with Pico.

Rationale:

- Opt-in rather than inferred from structure: structural triggers misfire on `p`, `td`, and `summary`.
- The value sets the side because CSS can't see text nodes.
- Grid, not flex: flex stretch doesn't give `aspect-ratio` a definite cross size.
- `contain: inline-size`: ligature text would widen icons until the icon font loads.
