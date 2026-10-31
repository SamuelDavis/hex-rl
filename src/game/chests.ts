import { hexKey, type Hex } from "./hex";
import type { Chest } from "./items";
import type { Game } from "./world";

export const EMPTY: Chest = { gold: 0, items: [] };

export const chestAt = (game: Game, at: Hex): Chest | undefined =>
  game.chests.get(hexKey(at));

export const withChest = (
  game: Game,
  at: Hex,
  { gold, items }: Chest,
): Game => {
  const chests = new Map(game.chests);
  if (gold > 0 || items.length > 0) chests.set(hexKey(at), { gold, items });
  else chests.delete(hexKey(at));
  return { ...game, chests };
};

export const piledOn = (game: Game, at: Hex, { gold, items }: Chest): Game => {
  const pile = chestAt(game, at) ?? EMPTY;
  return withChest(game, at, {
    gold: pile.gold + gold,
    items: [...pile.items, ...items],
  });
};
