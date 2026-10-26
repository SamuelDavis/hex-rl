import {
  add,
  hexDistance,
  hexesWithin,
  hexKey,
  lineBetween,
  type Hex,
} from "./hex";
import { surfaceOf, type Tile } from "./terrain";

export const SIGHT = 10;
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

export const visibleFrom = (tileAt: TileAt, eye: Hex): Set<string> =>
  new Set(
    SIGHT_OFFSETS.map((offset) => add(eye, offset))
      .filter((target) => canSee(tileAt, eye, target))
      .map(hexKey),
  );
