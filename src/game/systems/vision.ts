import { visibleFrom } from "../sight";
import { playerOf, type Game } from "../world";

/** Hex keys the player sees now. */
export const visibleOf = (game: Game): Set<string> => {
  const { at, facing } = playerOf(game);
  return visibleFrom(game.land.tileAt, at, facing);
};

/** Adds what the player sees now to what it has seen. */
export const vision = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleOf(game)]),
});
