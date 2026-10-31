import type { Bounds, Vec2 } from "procgen";
import { factionOfCreature, type Creature, type Player } from "../../game/game";
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
import { surfaceOf, type Spawner, type Tile } from "../../game/terrain";
import type { CanvasTheme } from "./canvasTheme";
import {
  ashen,
  css,
  drawEllipse,
  HAIRLINE,
  MARK_WIDTH,
  PIXELS_PER_UNIT,
  polyline,
  remembered,
  TILT,
  TOKEN_SIZE,
  type Hsl,
} from "./paint";

const PIXELS_PER_BLOCK = 7;
const MAX_RELIEF = 40;
const SIDE_SHADE = -14;
const EDGES = CORNERS.map((from, i) => {
  const to = CORNERS[(i + 1) % CORNERS.length]!;
  const facing = directionToward({ x: from.x + to.x, y: from.y + to.y });
  return { from: i, to: (i + 1) % CORNERS.length, facing };
});
const HILLSHADE_PER_BLOCK = 4;
const MAX_HILLSHADE = 12;
const FRONT = [DIRECTIONS.sw, DIRECTIONS.s, DIRECTIONS.se];
const FRONT_CORNERS = [0, 1, 2, 3];

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
  readonly theme: CanvasTheme;
  readonly tileAt: (hex: Hex) => Tile;
  readonly spawnersIn: (bounds: Bounds) => readonly Spawner[];
  readonly isWrecked: (spawner: Spawner) => boolean;
  readonly player: Player;
  readonly creatures: readonly Creature[];
  readonly chests: ReadonlyMap<string, unknown>;
  readonly visible: ReadonlySet<string>;
  readonly target: TargetMark | undefined;
  readonly aim: AimMark | undefined;
  /** The lair of the player's outstanding bounty, if any; marked over everything, fog included. */
  readonly bounty: Hex | undefined;
  readonly seen: ReadonlySet<string>;
  readonly width: number;
  readonly height: number;
}

export const drawScene = (
  context: CanvasRenderingContext2D,
  {
    theme,
    tileAt,
    spawnersIn,
    isWrecked,
    player,
    creatures,
    chests,
    visible,
    target,
    aim,
    bounty,
    seen,
    width,
    height,
  }: Scene,
) => {
  const { marks } = theme;
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
  const creatureAt = new Map(
    creatures
      .filter(({ at }) => visible.has(hexKey(at)))
      .map((creature) => [hexKey(creature.at), creature]),
  );

  context.fillStyle = css(theme.fog);
  context.fillRect(0, 0, width, height);
  context.lineWidth = HAIRLINE;

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
    const [h, sat, l] = theme.groundOf(tile);
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
    const edge = theme.edgeOf(color);

    const cliff =
      bottom < top
        ? {
            rim: FRONT_CORNERS.map((i) => corner(i, top)),
            drop: (top - bottom) * PIXELS_PER_BLOCK,
          }
        : undefined;
    if (cliff) {
      polygon([
        ...cliff.rim,
        ...[...FRONT_CORNERS].reverse().map((i) => corner(i, bottom)),
      ]);
      context.fillStyle = css(color, SIDE_SHADE);
      context.strokeStyle = edge;
      context.fill();
      context.stroke();
    }
    const face = CORNERS.map((_, i) => corner(i, top));
    polygon(face);
    context.fillStyle = css(color);
    context.strokeStyle = edge;
    context.fill();
    context.stroke();
    const base = project(center, top);
    theme.carve(context, { tile, color, face, base, cliff });
    const watched = target?.kind === "seen" ? target.sight : undefined;
    if (watched?.has(hexKey(hex))) {
      polygon(face);
      context.fillStyle = marks.watched;
      context.fill();
      context.beginPath();
      for (const { from, to, facing } of EDGES) {
        if (watched.has(hexKey(add(hex, DIRECTIONS[facing])))) continue;
        context.moveTo(face[from]!.x, face[from]!.y);
        context.lineTo(face[to]!.x, face[to]!.y);
      }
      context.strokeStyle = marks.watchedEdge;
      context.lineWidth = MARK_WIDTH;
      context.stroke();
      context.lineWidth = HAIRLINE;
    }
    if (aim?.area.has(hexKey(hex))) {
      polygon(face);
      context.fillStyle = marks.aimArea;
      context.fill();
    }

    if (tile.tree) theme.tree(context, base, tile.biome, lit);
    const spawner = spawnerAt.get(hexKey(hex));
    if (spawner)
      theme.spawner(context, base, spawner.kind, tile.biome, (color) =>
        lit(isWrecked(spawner) ? ashen(color) : color),
      );
    if (isVisible && chests.has(hexKey(hex))) theme.chest(context, base);
    if (target && sameHex(hex, target.at))
      drawReticle(context, base, marks.targeted);
    if (aim && sameHex(hex, aim.at)) drawReticle(context, base, marks.aimed);
    const creature = creatureAt.get(hexKey(hex));
    if (creature) {
      theme.creature(
        context,
        base,
        creature.kind,
        factionOfCreature(creature) === "town"
          ? "friendly"
          : creature.mind.state,
        headingOf(creature.facing),
      );
      theme.level(context, base, creature.level);
    } else if (target?.kind === "remembered" && sameHex(hex, target.at))
      theme.unknown(context, base);
    if (sameHex(hex, player.at))
      theme.player(context, base, headingOf(player.facing));
  }
  if (bounty)
    theme.bounty(context, project(centerOf(bounty), surfaceOf(tileAt(bounty))));
};

const headingOf = (direction: Direction): Vec2 => {
  const { x, y: depth } = centerOf(DIRECTIONS[direction]);
  const y = depth * TILT;
  const length = Math.sqrt(x * x + y * y);
  return { x: x / length, y: y / length };
};

const drawReticle = (
  context: CanvasRenderingContext2D,
  base: Vec2,
  color: string,
) => {
  drawEllipse(context, base, TOKEN_SIZE * 1.5);
  context.strokeStyle = color;
  context.lineWidth = MARK_WIDTH;
  context.stroke();
  context.lineWidth = HAIRLINE;
};
