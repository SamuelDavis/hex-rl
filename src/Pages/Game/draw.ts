import type { Bounds, Vec2 } from "procgen";
import type { Monster, Player } from "../../game/game";
import {
  add,
  centerOf,
  CORNERS,
  directionToward,
  DIRECTIONS,
  hexesCovering,
  hexKey,
  sameHex,
  type Direction,
  type Hex,
} from "../../game/hex";
import {
  Biome,
  SEA_LEVEL,
  surfaceOf,
  type Spawner,
  type Tile,
} from "../../game/terrain";
import {
  CHEST,
  CONIFER,
  MONSTER_FIGURES,
  PLAYER_FIGURE,
  SPAWNER_SPRITES,
  SPRITE_BOX,
  SPRITE_FOOT,
  TREE,
  type Figure,
  type Sprite,
  type Tone,
} from "./sprites";

const PIXELS_PER_UNIT = 20;
const TILT = 0.7;
const PIXELS_PER_BLOCK = 7;
const MAX_RELIEF = 40;
const SIDE_SHADE = -14;
const EDGE_SHADE = -6;
const SHADOW = "rgb(0 0 0 / 0.35)";
const WATCHED = "hsl(0 90% 50% / 0.15)";
const WATCHED_EDGE = "hsl(0 90% 60% / 0.7)";
const WATCHED_EDGE_WIDTH = 2;
const TARGETED: Hsl = [110, 100, 55];
const AIMED: Hsl = [25, 100, 55];
const AIM_AREA = "hsl(25 100% 55% / 0.3)";
const OUTLINE = 2.4;
const ETCH = 1.2;
const FIGURE_SIZE = PIXELS_PER_UNIT * 1.5;
const TREE_SIZE = PIXELS_PER_UNIT * 1.5;
const SPAWNER_SIZE = PIXELS_PER_UNIT * 1.8;
const CHEST_SIZE = PIXELS_PER_UNIT * 0.9;
const EDGES = CORNERS.map((from, i) => {
  const to = CORNERS[(i + 1) % CORNERS.length]!;
  const facing = directionToward({ x: from.x + to.x, y: from.y + to.y });
  return { from: i, to: (i + 1) % CORNERS.length, facing };
});
const HILLSHADE_PER_BLOCK = 4;
const MAX_HILLSHADE = 12;
const FRONT = [DIRECTIONS.sw, DIRECTIONS.s, DIRECTIONS.se];
const FRONT_CORNERS = [0, 1, 2, 3];

type Hsl = readonly [hue: number, saturation: number, lightness: number];
type Palette = Readonly<Record<Tone, Hsl>>;

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

const CONIFERS: ReadonlySet<Biome> = new Set([
  Biome.Taiga,
  Biome.Tundra,
  Biome.Mountain,
]);

const FOG: Hsl = [220, 15, 12];

const PALETTE: Palette = {
  ink: [15, 25, 9],
  bone: [43, 58, 80],
  blood: [5, 63, 53],
  leaf: CANOPY[Biome.Forest],
};

const RINGS: Record<Monster["mind"]["state"], Hsl> = {
  idle: PALETTE.bone,
  hostile: PALETTE.blood,
  hunting: [40, 80, 55],
};

export const screenRadiusOf = ({
  width,
  height,
}: Pick<Scene, "width" | "height">): number =>
  Math.floor(
    Math.min(
      width / 2 / (centerOf(DIRECTIONS.se).x * PIXELS_PER_UNIT),
      height / 2 / (centerOf(DIRECTIONS.s).y * PIXELS_PER_UNIT * TILT),
    ),
  );

export const groundOffsetOf = ({ x, y }: Vec2): Vec2 => ({
  x: x / PIXELS_PER_UNIT,
  y: y / (PIXELS_PER_UNIT * TILT),
});

const remembered = ([h, s, l]: Hsl): Hsl => [h, s * 0.3, l * 0.55];

const ashen = ([h, , l]: Hsl): Hsl => [h, 0, l];

const recolor = (palette: Palette, recolor: (color: Hsl) => Hsl): Palette =>
  Object.fromEntries(
    Object.entries(palette).map(([tone, color]) => [tone, recolor(color)]),
  ) as Palette;

const css = ([h, s, l]: Hsl, shade = 0) =>
  `hsl(${h} ${s}% ${Math.min(100, Math.max(0, l + shade))}%)`;

const colorOf = (tile: Tile): Hsl => {
  if (tile.water !== undefined)
    return [210, 60, Math.max(22, 52 - 4 * (tile.water - tile.ground))];
  const [h, s, l] = GROUND[tile.biome];
  return [h, s, l + 0.8 * (tile.ground - SEA_LEVEL)];
};

export type TargetMark =
  | {
      readonly kind: "seen";
      readonly at: Hex;
      readonly sight: ReadonlySet<string>;
    }
  | { readonly kind: "remembered"; readonly at: Hex };

export interface AimMark {
  readonly at: Hex;
  readonly area: ReadonlySet<string>;
}

export interface Scene {
  readonly tileAt: (hex: Hex) => Tile;
  readonly spawnersIn: (bounds: Bounds) => readonly Spawner[];
  readonly isWrecked: (spawner: Spawner) => boolean;
  readonly player: Player;
  readonly monsters: readonly Monster[];
  readonly chests: ReadonlyMap<string, unknown>;
  readonly visible: ReadonlySet<string>;
  readonly target: TargetMark | undefined;
  readonly aim: AimMark | undefined;
  readonly seen: ReadonlySet<string>;
  readonly width: number;
  readonly height: number;
}

export const drawScene = (
  context: CanvasRenderingContext2D,
  {
    tileAt,
    spawnersIn,
    isWrecked,
    player,
    monsters,
    chests,
    visible,
    target,
    aim,
    seen,
    width,
    height,
  }: Scene,
) => {
  const camera = centerOf(player.at);
  const eye = surfaceOf(tileAt(player.at));
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
  const view = {
    minX: camera.x - reach.x,
    maxX: camera.x + reach.x,
    minY: camera.y - reach.y,
    maxY: camera.y + reach.y,
  };
  const hexes = hexesCovering(view)
    .filter((hex) => seen.has(hexKey(hex)))
    .map((hex) => ({ hex, center: centerOf(hex) }))
    .sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x);

  const polygon = (points: readonly Vec2[]) => {
    polyline(context, points);
    context.closePath();
  };

  const spawnerAt = new Map(
    spawnersIn(view).map((spawner) => [hexKey(spawner.at), spawner]),
  );
  const monsterAt = new Map(
    monsters
      .filter(({ at }) => visible.has(hexKey(at)))
      .map((monster) => [hexKey(monster.at), monster]),
  );

  context.fillStyle = css(FOG);
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
    const isVisible = visible.has(hexKey(hex));
    const lit = (color: Hsl) => (isVisible ? color : remembered(color));
    const color = lit([
      h,
      sat,
      l +
        Math.max(
          -MAX_HILLSHADE,
          Math.min(MAX_HILLSHADE, HILLSHADE_PER_BLOCK * relief),
        ),
    ]);

    if (bottom < top) {
      polygon([
        ...FRONT_CORNERS.map((i) => corner(i, top)),
        ...[...FRONT_CORNERS].reverse().map((i) => corner(i, bottom)),
      ]);
      context.fillStyle = css(color, SIDE_SHADE);
      context.fill();
    }
    const face = CORNERS.map((_, i) => corner(i, top));
    polygon(face);
    context.fillStyle = css(color);
    context.strokeStyle = css(color, EDGE_SHADE);
    context.fill();
    context.stroke();
    const watched = target?.kind === "seen" ? target.sight : undefined;
    if (watched?.has(hexKey(hex))) {
      polygon(face);
      context.fillStyle = WATCHED;
      context.fill();
      context.beginPath();
      for (const { from, to, facing } of EDGES) {
        if (watched.has(hexKey(add(hex, DIRECTIONS[facing])))) continue;
        context.moveTo(face[from]!.x, face[from]!.y);
        context.lineTo(face[to]!.x, face[to]!.y);
      }
      context.strokeStyle = WATCHED_EDGE;
      context.lineWidth = WATCHED_EDGE_WIDTH;
      context.stroke();
      context.lineWidth = 0.6;
    }
    if (aim?.area.has(hexKey(hex))) {
      polygon(face);
      context.fillStyle = AIM_AREA;
      context.fill();
    }

    const base = project(center, top);
    if (tile.tree)
      drawSprite(
        context,
        CONIFERS.has(tile.biome) ? CONIFER : TREE,
        base,
        TREE_SIZE,
        recolor({ ...PALETTE, leaf: CANOPY[tile.biome] }, lit),
      );
    const spawner = spawnerAt.get(hexKey(hex));
    if (spawner)
      drawSprite(
        context,
        SPAWNER_SPRITES[spawner.kind],
        base,
        SPAWNER_SIZE,
        recolor(PALETTE, (color) =>
          lit(isWrecked(spawner) ? ashen(color) : color),
        ),
      );
    if (isVisible && chests.has(hexKey(hex)))
      drawSprite(context, CHEST, base, CHEST_SIZE, PALETTE);
    if (target && sameHex(hex, target.at)) drawReticle(context, base, TARGETED);
    if (aim && sameHex(hex, aim.at)) drawReticle(context, base, AIMED);
    const monster = monsterAt.get(hexKey(hex));
    if (monster)
      drawFigure(
        context,
        MONSTER_FIGURES[monster.kind],
        base,
        headingOf(monster.facing),
        RINGS[monster.mind.state],
      );
    else if (target?.kind === "remembered" && sameHex(hex, target.at))
      drawUnknown(context, base);
    if (sameHex(hex, player.at))
      drawFigure(context, PLAYER_FIGURE, base, headingOf(player.facing));
  }
};

const headingOf = (direction: Direction): Vec2 => {
  const { x, y: depth } = centerOf(DIRECTIONS[direction]);
  const y = depth * TILT;
  const length = Math.sqrt(x * x + y * y);
  return { x: x / length, y: y / length };
};

const TOKEN_SIZE = PIXELS_PER_UNIT * 0.5;

const drawReticle = (
  context: CanvasRenderingContext2D,
  { x, y }: Vec2,
  color: Hsl,
) => {
  const radius = TOKEN_SIZE * 1.5;
  context.beginPath();
  context.ellipse(x, y, radius, radius * TILT, 0, 0, 2 * Math.PI);
  context.strokeStyle = css(color);
  context.lineWidth = WATCHED_EDGE_WIDTH;
  context.stroke();
  context.lineWidth = 0.6;
};

const drawChevron = (
  context: CanvasRenderingContext2D,
  center: Vec2,
  heading: Vec2,
) => {
  const at = (along: number, across: number) => ({
    x: center.x + TOKEN_SIZE * (heading.x * along - heading.y * across),
    y: center.y + TOKEN_SIZE * (heading.y * along + heading.x * across),
  });
  polyline(context, [at(1.25, -0.55), at(1.75, 0), at(1.25, 0.55)]);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = css(PALETTE.ink);
  context.lineWidth = 5;
  context.stroke();
  context.strokeStyle = css(PALETTE.bone);
  context.lineWidth = 2.5;
  context.stroke();
  context.lineWidth = 0.6;
};

const polyline = (
  context: CanvasRenderingContext2D,
  points: readonly Vec2[],
) => {
  context.beginPath();
  points.forEach(({ x, y }) => context.lineTo(x, y));
};

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
  { x, y }: Vec2,
  radius: number,
  ring?: Hsl,
) => {
  context.beginPath();
  context.ellipse(x, y, radius, radius * TILT, 0, 0, 2 * Math.PI);
  context.fillStyle = SHADOW;
  context.fill();
  if (!ring) return;
  context.strokeStyle = css(ring);
  context.lineWidth = WATCHED_EDGE_WIDTH;
  context.stroke();
  context.lineWidth = 0.6;
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
  drawChevron(context, base, heading);
};

const drawUnknown = (context: CanvasRenderingContext2D, base: Vec2) => {
  drawFootprint(context, base, TOKEN_SIZE);
  context.font = `bold ${FIGURE_SIZE * 0.8}px serif`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = OUTLINE * 1.5;
  context.strokeStyle = css(PALETTE.ink);
  context.fillStyle = css(remembered(PALETTE.bone));
  context.strokeText("?", base.x, base.y);
  context.fillText("?", base.x, base.y);
  context.lineWidth = 0.6;
};
