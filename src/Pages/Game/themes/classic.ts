import type { Vec2 } from "procgen";
import type { CreatureKind, SpawnerKind } from "../../../game/creatures";
import { Biome, CONIFEROUS, SEA_LEVEL } from "../../../game/terrain";
import type { CanvasTheme, Disposition } from "../canvasTheme";
import {
  css,
  drawChevron,
  drawEllipse,
  drawLabel,
  levelSpotOf,
  HAIRLINE,
  PIXELS_PER_UNIT,
  polyline,
  TILT,
  TOKEN_SIZE,
  type Hsl,
} from "../paint";

const EDGE_SHADE = -6;
const TOKEN_LIFT = 0.9;
const SHADOW = "rgb(0 0 0 / 0.35)";
const WHITE: Hsl = [0, 0, 100];
const REMEMBERED_TOKEN: Hsl = [0, 0, 40];
const PLAYER_TOKEN: Hsl = [0, 80, 55];
const GOLD: Hsl = [48, 95, 55];
const WOOD: Hsl = [28, 55, 32];
const TRUNK: Hsl = [25, 40, 28];

const RINGS: Record<Disposition, Hsl> = {
  friendly: [210, 80, 60],
  idle: WHITE,
  hostile: [0, 90, 55],
  hunting: [40, 95, 55],
};

const TOKENS: Record<CreatureKind, { glyph: string; hue: number }> = {
  wolf: { glyph: "w", hue: 30 },
  cub: { glyph: "c", hue: 35 },
  bandit: { glyph: "b", hue: 0 },
  thief: { glyph: "t", hue: 320 },
  kobold: { glyph: "k", hue: 60 },
  goblin: { glyph: "g", hue: 90 },
  troll: { glyph: "T", hue: 280 },
  "alpha wolf": { glyph: "W", hue: 20 },
  "bandit chief": { glyph: "B", hue: 350 },
  "goblin chief": { glyph: "G", hue: 100 },
  "kobold foreman": { glyph: "K", hue: 50 },
  "troll elder": { glyph: "E", hue: 270 },
  bailiff: { glyph: "§", hue: 220 },
  reeve: { glyph: "$", hue: 45 },
  peasant: { glyph: "p", hue: 140 },
};

const SPAWNER_HUES: Record<SpawnerKind, number> = {
  den: 30,
  camp: 0,
  village: 90,
  mine: 60,
  cave: 280,
  town: 210,
};

/** Towns take on their biome's look. */
const TOWN_COLORS: Record<Biome, Hsl> = {
  [Biome.Ocean]: [200, 35, 40],
  [Biome.Beach]: [200, 35, 40],
  [Biome.Desert]: [25, 50, 42],
  [Biome.Plains]: [45, 50, 38],
  [Biome.Forest]: [100, 30, 28],
  [Biome.Taiga]: [20, 30, 25],
  [Biome.Tundra]: [200, 15, 65],
  [Biome.Mountain]: [220, 10, 35],
  [Biome.Peak]: [200, 15, 65],
  [Biome.Marsh]: [65, 30, 30],
};

const GROUND: Record<Biome, Hsl> = {
  [Biome.Ocean]: [40, 30, 55],
  [Biome.Beach]: [45, 60, 75],
  [Biome.Desert]: [38, 55, 65],
  [Biome.Plains]: [95, 45, 50],
  [Biome.Forest]: [110, 45, 38],
  [Biome.Taiga]: [140, 25, 38],
  [Biome.Tundra]: [200, 20, 88],
  [Biome.Mountain]: [30, 5, 52],
  [Biome.Peak]: [210, 30, 96],
  [Biome.Marsh]: [75, 30, 38],
};

const CANOPY: Record<Biome, Hsl> = {
  ...GROUND,
  [Biome.Forest]: [115, 50, 26],
  [Biome.Plains]: [105, 45, 32],
  [Biome.Taiga]: [150, 35, 22],
  [Biome.Tundra]: [150, 25, 30],
  [Biome.Desert]: [90, 40, 35],
  [Biome.Mountain]: [140, 30, 25],
  [Biome.Marsh]: [95, 30, 24],
};

const tokenCenterOf = ({ x, y }: Vec2): Vec2 => ({
  x,
  y: y - TOKEN_SIZE * TOKEN_LIFT,
});

const drawToken = (
  context: CanvasRenderingContext2D,
  base: Vec2,
  {
    fill,
    glyph,
    ring = WHITE,
    heading = { x: 1, y: 0 },
  }: {
    readonly fill: Hsl;
    readonly glyph: string;
    readonly ring?: Hsl;
    readonly heading?: Vec2;
  },
) => {
  const center = tokenCenterOf(base);
  drawEllipse(context, base, TOKEN_SIZE);
  context.fillStyle = SHADOW;
  context.fill();
  context.fillStyle = css(fill);
  context.strokeStyle = css(ring);
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(center.x, center.y, TOKEN_SIZE, 0, 2 * Math.PI);
  context.fill();
  context.stroke();
  context.lineWidth = HAIRLINE;
  context.fillStyle = css(WHITE);
  context.font = `bold ${TOKEN_SIZE * 1.3}px monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.save();
  context.transform(
    heading.x,
    heading.y,
    -heading.y,
    heading.x,
    center.x,
    center.y,
  );
  context.fillText(glyph, 0, 0);
  context.restore();
};

export const CLASSIC: CanvasTheme = {
  level: (context, base, level) =>
    drawLabel(context, levelSpotOf(base), String(level), {
      font: `bold ${TOKEN_SIZE}px monospace`,
      fill: css(WHITE),
      halo: SHADOW,
      width: 3,
    }),
  fog: [220, 15, 12],
  marks: {
    watched: "hsl(0 90% 50% / 0.15)",
    watchedEdge: "hsl(0 90% 60% / 0.7)",
    targeted: css([110, 100, 55]),
    aimed: css([25, 100, 55]),
    aimArea: "hsl(25 100% 55% / 0.3)",
  },
  groundOf: (tile) => {
    if (tile.water !== undefined)
      return [210, 60, Math.max(22, 52 - 4 * (tile.water - tile.ground))];
    const [h, s, l] = GROUND[tile.biome];
    return [h, s, l + 0.8 * (tile.ground - SEA_LEVEL)];
  },
  edgeOf: (ground) => css(ground, EDGE_SHADE),
  carve: () => {},
  tree: (context, { x, y }, biome, tint) => {
    const size = PIXELS_PER_UNIT * 0.6;
    const canopy = tint(CANOPY[biome]);
    context.fillStyle = css(tint(TRUNK));
    context.fillRect(x - 1.5, y - size, 3, size);
    context.fillStyle = css(canopy);
    context.strokeStyle = css(canopy, -10);
    context.beginPath();
    if (CONIFEROUS.has(biome)) {
      context.moveTo(x, y - size * 2.6);
      context.lineTo(x + size * 0.7, y - size * 0.6);
      context.lineTo(x - size * 0.7, y - size * 0.6);
      context.closePath();
    } else context.arc(x, y - size * 1.4, size * 0.75, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
  },
  spawner: (context, { x, y }, kind, biome, tint) => {
    const size = PIXELS_PER_UNIT * 0.8;
    const color = tint(
      kind === "town" ? TOWN_COLORS[biome] : [SPAWNER_HUES[kind], 35, 30],
    );
    polyline(context, [
      { x: x - size, y },
      { x, y: y - size * 1.2 },
      { x: x + size, y },
    ]);
    context.closePath();
    context.fillStyle = css(color);
    context.strokeStyle = css(color, -15);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(x, y, size * 0.35, Math.PI, 0);
    context.fillStyle = css(color, -20);
    context.fill();
  },
  bounty: (context, base) => {
    drawEllipse(context, base, TOKEN_SIZE * 2);
    context.strokeStyle = css(GOLD);
    context.lineWidth = 2.5;
    context.stroke();
    context.lineWidth = HAIRLINE;
    drawLabel(context, { x: base.x, y: base.y - PIXELS_PER_UNIT * 1.4 }, "!", {
      font: `bold ${TOKEN_SIZE * 2}px monospace`,
      fill: css(GOLD),
      halo: SHADOW,
      width: 3,
    });
  },
  chest: (context, { x, y }) => {
    const width = PIXELS_PER_UNIT * 0.7;
    const height = width * TILT;
    const left = x - width / 2;
    const top = y - height / 2;
    context.fillStyle = css(WOOD);
    context.strokeStyle = css(WOOD, -20);
    context.fillRect(left, top, width, height);
    context.strokeRect(left, top, width, height);
    context.fillStyle = css(GOLD);
    context.fillRect(left, top + height * 0.35, width, height * 0.15);
    context.fillRect(
      x - width * 0.08,
      top + height * 0.3,
      width * 0.16,
      height * 0.3,
    );
  },
  player: (context, base, heading) =>
    drawToken(context, base, { fill: PLAYER_TOKEN, glyph: "@", heading }),
  creature: (context, base, kind, disposition, heading) => {
    const { glyph, hue } = TOKENS[kind];
    drawToken(context, base, {
      fill: [hue, 60, 30],
      glyph,
      ring: RINGS[disposition],
    });
    drawChevron(context, tokenCenterOf(base), heading, {
      line: css(WHITE),
      halo: SHADOW,
    });
  },
  unknown: (context, base) =>
    drawToken(context, base, { fill: REMEMBERED_TOKEN, glyph: "?" }),
};
