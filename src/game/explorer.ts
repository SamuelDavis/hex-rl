import type { Hex } from "./hex";
import { surfaceOf, type Tile } from "./terrain";

export const CLIMB = 1;

export const canStep = (
  tileAt: (hex: Hex) => Tile,
  from: Hex,
  to: Hex,
): boolean => surfaceOf(tileAt(to)) - surfaceOf(tileAt(from)) <= CLIMB;
