import { playerOf, type Game } from "../../game/game";
import {
  add,
  DIRECTIONS,
  hexDistance,
  type Direction,
  type Hex,
} from "../../game/hex";

const isInRange = (game: Game, range: number, at: Hex) =>
  hexDistance(playerOf(game).at, at) <= range;

export const startAim = (
  game: Game,
  range: number,
  target: Hex | undefined,
): Hex => {
  if (target && isInRange(game, range, target)) return target;
  const { at, facing } = playerOf(game);
  return add(at, DIRECTIONS[facing]);
};

export const aimed = (
  game: Game,
  range: number,
  at: Hex,
  toward: Direction,
): Hex => {
  const next = add(at, DIRECTIONS[toward]);
  return isInRange(game, range, next) ? next : at;
};
