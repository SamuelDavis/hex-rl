import type { Vec2 } from "procgen";
import {
  add,
  centerOf,
  CORNERS,
  DIRECTIONS,
  hexesCovering,
  sameHex,
  type Hex,
} from "./hex";
import { Biome, SEA_LEVEL, surfaceOf, type Tile } from "./terrain";

const PIXELS_PER_UNIT = 20;
const TILT = 0.7;
const PIXELS_PER_BLOCK = 7;
const MAX_RELIEF = 40;
const SIDE_SHADE = -14;
const EDGE_SHADE = -6;
const HILLSHADE_PER_BLOCK = 4;
const MAX_HILLSHADE = 12;
const FRONT = [DIRECTIONS.sw, DIRECTIONS.s, DIRECTIONS.se];
const FRONT_CORNERS = [0, 1, 2, 3];

type Hsl = readonly [hue: number, saturation: number, lightness: number];

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
};

const CANOPY: Record<Biome, Hsl> = {
  ...GROUND,
  [Biome.Forest]: [115, 50, 26],
  [Biome.Plains]: [105, 45, 32],
  [Biome.Taiga]: [150, 35, 22],
  [Biome.Tundra]: [150, 25, 30],
  [Biome.Desert]: [90, 40, 35],
  [Biome.Mountain]: [140, 30, 25],
};

const CONIFERS: ReadonlySet<Biome> = new Set([
  Biome.Taiga,
  Biome.Tundra,
  Biome.Mountain,
]);

const css = ([h, s, l]: Hsl, shade = 0) =>
  `hsl(${h} ${s}% ${Math.min(100, Math.max(0, l + shade))}%)`;

const colorOf = (tile: Tile): Hsl => {
  if (tile.water !== undefined)
    return [210, 60, Math.max(22, 52 - 4 * (tile.water - tile.ground))];
  const [h, s, l] = GROUND[tile.biome];
  return [h, s, l + 0.8 * (tile.ground - SEA_LEVEL)];
};

export interface Scene {
  readonly tileAt: (hex: Hex) => Tile;
  readonly player: Hex;
  readonly width: number;
  readonly height: number;
}

export const drawScene = (
  context: CanvasRenderingContext2D,
  { tileAt, player, width, height }: Scene,
) => {
  const camera = centerOf(player);
  const eye = surfaceOf(tileAt(player));
  const project = ({ x, y }: Vec2, level: number): Vec2 => ({
    x: width / 2 + (x - camera.x) * PIXELS_PER_UNIT,
    y:
      height / 2 +
      (y - camera.y) * PIXELS_PER_UNIT * TILT -
      (level - eye) * PIXELS_PER_BLOCK,
  });
  const reach = {
    x: width / 2 / PIXELS_PER_UNIT + 1,
    y: (height / 2 + MAX_RELIEF * PIXELS_PER_BLOCK) / (PIXELS_PER_UNIT * TILT),
  };
  const hexes = hexesCovering({
    minX: camera.x - reach.x,
    maxX: camera.x + reach.x,
    minY: camera.y - reach.y,
    maxY: camera.y + reach.y,
  })
    .map((hex) => ({ hex, center: centerOf(hex) }))
    .sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x);

  const polygon = (points: readonly Vec2[]) => {
    context.beginPath();
    points.forEach(({ x, y }) => context.lineTo(x, y));
    context.closePath();
  };

  context.fillStyle = css([205, 60, 80]);
  context.fillRect(0, 0, width, height);
  context.lineWidth = 0.6;

  for (const { hex, center } of hexes) {
    const tile = tileAt(hex);
    const top = surfaceOf(tile);
    const bottom = Math.min(
      top,
      ...FRONT.map((offset) => surfaceOf(tileAt(add(hex, offset)))),
    );
    const corner = (i: number, level: number) =>
      project(
        { x: center.x + CORNERS[i]!.x, y: center.y + CORNERS[i]!.y },
        level,
      );
    const relief = top - surfaceOf(tileAt(add(hex, DIRECTIONS.n)));
    const [h, sat, l] = colorOf(tile);
    const color: Hsl = [
      h,
      sat,
      l +
        Math.max(
          -MAX_HILLSHADE,
          Math.min(MAX_HILLSHADE, HILLSHADE_PER_BLOCK * relief),
        ),
    ];

    if (bottom < top) {
      polygon([
        ...FRONT_CORNERS.map((i) => corner(i, top)),
        ...[...FRONT_CORNERS].reverse().map((i) => corner(i, bottom)),
      ]);
      context.fillStyle = css(color, SIDE_SHADE);
      context.fill();
    }
    polygon(CORNERS.map((_, i) => corner(i, top)));
    context.fillStyle = css(color);
    context.strokeStyle = css(color, EDGE_SHADE);
    context.fill();
    context.stroke();

    const base = project(center, top);
    if (tile.tree)
      drawTree(context, base, CANOPY[tile.biome], CONIFERS.has(tile.biome));
    if (sameHex(hex, player)) drawPlayer(context, base);
  }
};

const drawTree = (
  context: CanvasRenderingContext2D,
  { x, y }: Vec2,
  canopy: Hsl,
  isConifer: boolean,
) => {
  const size = PIXELS_PER_UNIT * 0.6;
  context.fillStyle = css([25, 40, 28]);
  context.fillRect(x - 1.5, y - size, 3, size);
  context.fillStyle = css(canopy);
  context.strokeStyle = css(canopy, -10);
  if (isConifer) {
    context.beginPath();
    context.moveTo(x, y - size * 2.6);
    context.lineTo(x + size * 0.7, y - size * 0.6);
    context.lineTo(x - size * 0.7, y - size * 0.6);
    context.closePath();
  } else {
    context.beginPath();
    context.arc(x, y - size * 1.4, size * 0.75, 0, 2 * Math.PI);
  }
  context.fill();
  context.stroke();
};

const drawPlayer = (context: CanvasRenderingContext2D, { x, y }: Vec2) => {
  const size = PIXELS_PER_UNIT * 0.5;
  context.fillStyle = css([0, 80, 55]);
  context.strokeStyle = css([0, 0, 100]);
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(x, y - size * 1.6, size, 0, 2 * Math.PI);
  context.fill();
  context.stroke();
  context.lineWidth = 0.6;
};
