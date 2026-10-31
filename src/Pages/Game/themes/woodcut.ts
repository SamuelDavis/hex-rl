import type { Vec2 } from "procgen";
import { spawnerOf } from "../../../game/content/creatures";
import { Biome, CONIFEROUS, SEA_LEVEL } from "../../../game/terrain";
import type { CanvasTheme, Disposition } from "../canvasTheme";
import {
  css,
  drawChevron,
  drawEllipse,
  drawLabel,
  levelSpotOf,
  HAIRLINE,
  MARK_WIDTH,
  PIXELS_PER_UNIT,
  remembered,
  TILT,
  TOKEN_SIZE,
  type Hsl,
  type Tint,
} from "../paint";
import {
  CHEST,
  CONIFER,
  CREATURE_FIGURES,
  PLAYER_FIGURE,
  SPAWNER_SPRITES,
  SPRITE_BOX,
  SPRITE_FOOT,
  TREE,
  type Figure,
  type Sprite,
  type Tone,
} from "../sprites";

type Palette = Readonly<Record<Tone, Hsl>>;

const SHADOW = "hsl(15 25% 9% / 0.4)";
const GROOVE = "hsl(15 25% 9% / 0.45)";
const HATCH_SPACING = 3;
const WAVE_CREST = 12;
const WAVES = [
  { x: -0.45, y: -0.2, length: 0.4 },
  { x: 0.05, y: 0.25, length: 0.45 },
];
const OUTLINE = 2.4;
const ETCH = 1.2;
const FIGURE_SIZE = PIXELS_PER_UNIT * 1.5;
const TREE_SIZE = PIXELS_PER_UNIT * 1.5;
const SPAWNER_SIZE = PIXELS_PER_UNIT * 1.8;
const CHEST_SIZE = PIXELS_PER_UNIT * 0.9;

const GROUND: Record<Biome, Hsl> = {
  [Biome.Ocean]: [35, 20, 45],
  [Biome.Beach]: [42, 45, 70],
  [Biome.Desert]: [34, 45, 58],
  [Biome.Plains]: [62, 24, 44],
  [Biome.Forest]: [75, 20, 33],
  [Biome.Taiga]: [95, 12, 31],
  [Biome.Tundra]: [40, 18, 74],
  [Biome.Mountain]: [25, 8, 42],
  [Biome.Peak]: [43, 40, 86],
  [Biome.Marsh]: [55, 18, 29],
};

const CANOPY: Record<Biome, Hsl> = {
  ...GROUND,
  [Biome.Forest]: [85, 26, 24],
  [Biome.Plains]: [75, 26, 30],
  [Biome.Taiga]: [110, 18, 21],
  [Biome.Tundra]: [110, 14, 28],
  [Biome.Desert]: [65, 24, 32],
  [Biome.Mountain]: [100, 16, 23],
  [Biome.Marsh]: [70, 20, 22],
};

/** Town folk's roofs (their sprites' `leaf`) take on their biome's look. */
const ROOFS: Record<Biome, Hsl> = {
  [Biome.Ocean]: [200, 20, 45],
  [Biome.Beach]: [200, 20, 45],
  [Biome.Desert]: [22, 45, 48],
  [Biome.Plains]: [42, 45, 52],
  [Biome.Forest]: [85, 26, 30],
  [Biome.Taiga]: [18, 30, 26],
  [Biome.Tundra]: [40, 20, 86],
  [Biome.Mountain]: [25, 6, 38],
  [Biome.Peak]: [40, 20, 86],
  [Biome.Marsh]: [60, 25, 34],
};

const PALETTE: Palette = {
  ink: [15, 25, 9],
  bone: [43, 58, 80],
  blood: [5, 63, 53],
  leaf: CANOPY[Biome.Forest],
};

const RINGS: Record<Disposition, Hsl> = {
  friendly: [200, 45, 55],
  idle: PALETTE.bone,
  hostile: PALETTE.blood,
  hunting: [40, 80, 55],
};

const CHEVRON = { line: css(PALETTE.bone), halo: css(PALETTE.ink) };

const tinted = (palette: Palette, tint: Tint): Palette =>
  Object.fromEntries(
    Object.entries(palette).map(([tone, color]) => [tone, tint(color)]),
  ) as Palette;

const paths = new Map<string, Path2D>();

const pathOf = (data: string): Path2D =>
  paths.get(data) ?? paths.set(data, new Path2D(data)).get(data)!;

const drawSprite = (
  context: CanvasRenderingContext2D,
  sprite: Sprite,
  { x, y }: Vec2,
  size: number,
  palette: Palette,
  isMirrored = false,
) => {
  const scale = size / SPRITE_BOX;
  context.save();
  context.translate(x, y);
  context.scale(isMirrored ? -scale : scale, scale);
  context.translate(-SPRITE_BOX / 2, -SPRITE_FOOT);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = css(palette.ink);
  for (const { tone, path } of sprite) {
    const shape = pathOf(path);
    if (tone === "etch") {
      context.lineWidth = ETCH;
      context.stroke(shape);
      continue;
    }
    if (tone !== "ink") {
      context.lineWidth = OUTLINE;
      context.stroke(shape);
    }
    context.fillStyle = css(palette[tone]);
    context.fill(shape);
  }
  context.restore();
};

const drawFootprint = (
  context: CanvasRenderingContext2D,
  base: Vec2,
  radius: number,
  ring?: Hsl,
) => {
  drawEllipse(context, base, radius);
  context.fillStyle = SHADOW;
  context.fill();
  if (!ring) return;
  context.strokeStyle = css(ring);
  context.lineWidth = MARK_WIDTH;
  context.stroke();
  context.lineWidth = HAIRLINE;
};

const drawFigure = (
  context: CanvasRenderingContext2D,
  { sprite, scale }: Figure,
  base: Vec2,
  heading: Vec2,
  ring?: Hsl,
) => {
  drawFootprint(context, base, TOKEN_SIZE * scale, ring);
  drawSprite(
    context,
    sprite,
    base,
    FIGURE_SIZE * scale,
    PALETTE,
    heading.x < 0,
  );
  drawChevron(context, base, heading, CHEVRON);
};

const hatch = (
  context: CanvasRenderingContext2D,
  rim: readonly Vec2[],
  drop: number,
) => {
  context.beginPath();
  rim.slice(1).forEach((to, i) => {
    const from = rim[i]!;
    const strokes = Math.floor(
      Math.hypot(to.x - from.x, to.y - from.y) / HATCH_SPACING,
    );
    for (let k = 1; k < strokes; k++) {
      const x = from.x + ((to.x - from.x) * k) / strokes;
      const y = from.y + ((to.y - from.y) * k) / strokes;
      context.moveTo(x, y);
      context.lineTo(x, y + drop);
    }
  });
  context.strokeStyle = GROOVE;
  context.stroke();
};

const etchWaves = (
  context: CanvasRenderingContext2D,
  { x, y }: Vec2,
  crest: string,
) => {
  context.beginPath();
  for (const wave of WAVES) {
    const left = x + wave.x * PIXELS_PER_UNIT;
    const top = y + wave.y * PIXELS_PER_UNIT * TILT;
    context.moveTo(left, top);
    context.lineTo(left + wave.length * PIXELS_PER_UNIT, top);
  }
  context.strokeStyle = crest;
  context.lineCap = "round";
  context.lineWidth = ETCH;
  context.stroke();
  context.lineWidth = HAIRLINE;
};

export const WOODCUT: CanvasTheme = {
  fog: PALETTE.ink,
  marks: {
    watched: "hsl(5 63% 53% / 0.18)",
    watchedEdge: "hsl(5 63% 58% / 0.8)",
    targeted: css(PALETTE.bone),
    aimed: css([36, 75, 55]),
    aimArea: "hsl(36 75% 55% / 0.3)",
  },
  groundOf: (tile) => {
    if (tile.water !== undefined)
      return [205, 22, Math.max(16, 40 - 4 * (tile.water - tile.ground))];
    const [h, s, l] = GROUND[tile.biome];
    return [h, s, l + 0.8 * (tile.ground - SEA_LEVEL)];
  },
  edgeOf: () => GROOVE,
  carve: (context, { tile, color, base, cliff }) => {
    if (cliff) hatch(context, cliff.rim, cliff.drop);
    if (tile.water !== undefined)
      etchWaves(context, base, css(color, WAVE_CREST));
  },
  tree: (context, base, biome, tint) =>
    drawSprite(
      context,
      CONIFEROUS.has(biome) ? CONIFER : TREE,
      base,
      TREE_SIZE,
      tinted({ ...PALETTE, leaf: CANOPY[biome] }, tint),
    ),
  spawner: (context, base, kind, biome, tint) =>
    drawSprite(
      context,
      SPAWNER_SPRITES[kind],
      base,
      SPAWNER_SIZE,
      tinted(
        spawnerOf(kind).faction === "town"
          ? { ...PALETTE, leaf: ROOFS[biome] }
          : PALETTE,
        tint,
      ),
    ),
  bounty: (context, base) => {
    drawFootprint(context, base, TOKEN_SIZE * 2, PALETTE.blood);
    drawLabel(context, { x: base.x, y: base.y - SPAWNER_SIZE * 1.05 }, "✠", {
      font: `bold ${FIGURE_SIZE * 0.6}px serif`,
      fill: css(PALETTE.blood),
      halo: css(PALETTE.ink),
      width: OUTLINE * 1.5,
    });
  },
  chest: (context, base) =>
    drawSprite(context, CHEST, base, CHEST_SIZE, PALETTE),
  player: (context, base, heading) =>
    drawFigure(context, PLAYER_FIGURE, base, heading),
  creature: (context, base, kind, disposition, heading) =>
    drawFigure(
      context,
      CREATURE_FIGURES[kind],
      base,
      heading,
      RINGS[disposition],
    ),
  unknown: (context, base) => {
    drawFootprint(context, base, TOKEN_SIZE);
    drawLabel(context, base, "?", {
      font: `bold ${FIGURE_SIZE * 0.8}px serif`,
      fill: css(remembered(PALETTE.bone)),
      halo: css(PALETTE.ink),
      width: OUTLINE * 1.5,
    });
  },
  level: (context, base, level) =>
    drawLabel(context, levelSpotOf(base), String(level), {
      font: `bold ${FIGURE_SIZE * 0.4}px serif`,
      fill: css(PALETTE.bone),
      halo: css(PALETTE.ink),
      width: OUTLINE,
    }),
};
