import {
  add,
  DIRECTIONS,
  hexDistance,
  hexesWithin,
  hexKey,
  lineBetween,
  type Direction,
  type Hex,
} from "./hex";
import { surfaceOf, type Tile } from "./terrain";

export const SIGHT = 10;
export const AWARENESS = 2;
const EYE_HEIGHT = 1.5;
const TREE_HEIGHT = 3;

type TileAt = (hex: Hex) => Tile;

const obstacleOf = (tile: Tile) =>
  surfaceOf(tile) + (tile.tree ? TREE_HEIGHT : 0);

export const canSee = (tileAt: TileAt, eye: Hex, target: Hex): boolean => {
  const steps = hexDistance(eye, target);
  if (steps > SIGHT) return false;
  const from = surfaceOf(tileAt(eye)) + EYE_HEIGHT;
  const to = surfaceOf(tileAt(target));
  return lineBetween(eye, target)
    .slice(1, -1)
    .every(
      (hex, i) =>
        obstacleOf(tileAt(hex)) <= from + ((to - from) * (i + 1)) / steps,
    );
};

const SIGHT_OFFSETS = hexesWithin(SIGHT);

const isWithinCone = (offset: Hex, facing: Direction): boolean => {
  const { q, r } = DIRECTIONS[facing];
  return (
    offset.q * q >= 0 &&
    offset.r * r >= 0 &&
    (offset.q + offset.r) * (q + r) >= 0
  );
};

const isNoticed = (offset: Hex, facing: Direction): boolean =>
  hexDistance(offset, { q: 0, r: 0 }) <= AWARENESS ||
  isWithinCone(offset, facing);

export const canNotice = (
  tileAt: TileAt,
  eye: Hex,
  facing: Direction,
  target: Hex,
): boolean =>
  isNoticed({ q: target.q - eye.q, r: target.r - eye.r }, facing) &&
  canSee(tileAt, eye, target);

export const visibleFrom = (
  tileAt: TileAt,
  eye: Hex,
  facing: Direction,
): Set<string> =>
  new Set(
    SIGHT_OFFSETS.map((offset) => add(eye, offset))
      .filter((target) => canNotice(tileAt, eye, facing, target))
      .map(hexKey),
  );
