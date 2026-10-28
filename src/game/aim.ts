import type { Game } from "./game";
import { add, DIRECTIONS, hexDistance, type Direction, type Hex } from "./hex";

const isInRange = ({ player }: Game, range: number, at: Hex) =>
  hexDistance(player.at, at) <= range;

export const startAim = (
  game: Game,
  range: number,
  target: Hex | undefined,
): Hex => {
  if (target && isInRange(game, range, target)) return target;
  const { at, facing } = game.player;
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
