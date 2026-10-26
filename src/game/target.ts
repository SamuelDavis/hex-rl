import { visibleOf, type Game, type Monster } from "./game";
import { hexDistance, hexKey, type Hex } from "./hex";
import { visibleFrom } from "./sight";

export const TARGET_MEMORY = 3;

export interface Target {
  readonly id: string;
  readonly lastSeen: Hex;
  readonly seenTurn: number;
}

export const sightOf = ({ land }: Game, { at, facing }: Monster) =>
  visibleFrom(land.tileAt, at, facing);

const targetsOf = (game: Game, range: number): Monster[] => {
  const visible = visibleOf(game);
  const distanceOf = (at: Hex) => hexDistance(at, game.player.at);
  return game.monsters
    .filter(({ at }) => visible.has(hexKey(at)) && distanceOf(at) <= range)
    .sort((a, b) => distanceOf(a.at) - distanceOf(b.at));
};

const seen = (game: Game, { id, at }: Monster): Target => ({
  id,
  lastSeen: at,
  seenTurn: game.turn,
});

export const targetInView = (
  game: Game,
  range: number,
  target: Target,
): Monster | undefined =>
  targetsOf(game, range).find(({ id }) => id === target.id);

export const nextTarget = (
  game: Game,
  range: number,
  current: Target | undefined,
): Target | undefined => {
  const targets = targetsOf(game, range);
  const index = targets.findIndex(({ id }) => id === current?.id);
  const next = index === -1 ? targets[0] : targets[index + 1];
  return next && seen(game, next);
};

export const tracked = (
  game: Game,
  range: number,
  target: Target,
): Target | undefined => {
  const monster = game.monsters.find(({ id }) => id === target.id);
  if (!monster || hexDistance(monster.at, game.player.at) > range)
    return undefined;
  if (targetInView(game, range, target)) return seen(game, monster);
  if (game.turn - target.seenTurn >= TARGET_MEMORY) return undefined;
  return target;
};
