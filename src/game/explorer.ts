import { add, DIRECTIONS, type Direction, type Hex } from "./hex";
import { surfaceOf, type Tile } from "./terrain";

export const CLIMB = 1;

export const stepFrom = (
  tileAt: (hex: Hex) => Tile,
  at: Hex,
  direction: Direction,
): Hex => {
  const to = add(at, DIRECTIONS[direction]);
  return surfaceOf(tileAt(to)) - surfaceOf(tileAt(at)) <= CLIMB ? to : at;
};
