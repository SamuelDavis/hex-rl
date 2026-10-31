import { visibleOf, type Game, type Creature } from "../../game/game";
import { hexDistance, hexKey, type Hex } from "../../game/hex";
import { visibleFrom } from "../../game/sight";

export const TARGET_MEMORY = 3;

export interface Target {
  readonly id: string;
  readonly lastSeen: Hex;
  readonly seenTurn: number;
}

export const sightOf = ({ land }: Game, { at, facing }: Creature) =>
  visibleFrom(land.tileAt, at, facing);

const targetsOf = (game: Game, range: number): Creature[] => {
  const visible = visibleOf(game);
  const distanceOf = (at: Hex) => hexDistance(at, game.player.at);
  return game.creatures
    .filter(({ at }) => visible.has(hexKey(at)) && distanceOf(at) <= range)
    .sort((a, b) => distanceOf(a.at) - distanceOf(b.at));
};

export const targetOf = (game: Game, { id, at }: Creature): Target => ({
  id,
  lastSeen: at,
  seenTurn: game.turn,
});

export const targetInView = (
  game: Game,
  range: number,
  target: Target,
): Creature | undefined =>
  targetsOf(game, range).find(({ id }) => id === target.id);

export const nextTarget = (
  game: Game,
  range: number,
  current: Target | undefined,
): Target | undefined => {
  const targets = targetsOf(game, range);
  const index = targets.findIndex(({ id }) => id === current?.id);
  const next = index === -1 ? targets[0] : targets[index + 1];
  return next && targetOf(game, next);
};

export const tracked = (
  game: Game,
  range: number,
  target: Target,
): Target | undefined => {
  const creature = game.creatures.find(({ id }) => id === target.id);
  if (!creature || hexDistance(creature.at, game.player.at) > range)
    return undefined;
  if (targetInView(game, range, target)) return targetOf(game, creature);
  if (game.turn - target.seenTurn >= TARGET_MEMORY) return undefined;
  return target;
};
