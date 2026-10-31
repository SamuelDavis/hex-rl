import { visibleFrom } from "../sight";
import { playerOf, tilesOf, type Game } from "../world";

/** Hex keys the player sees now. */
export const visibleOf = (game: Game): Set<string> => {
  const { at, facing } = playerOf(game);
  return visibleFrom(tilesOf(game), at, facing);
};

/** Adds what the player sees now to what it has seen. */
export const vision = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleOf(game)]),
});
