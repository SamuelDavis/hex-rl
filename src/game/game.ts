import { findPath, type Bounds } from "procgen";
import { canStep } from "./explorer";
import {
  add,
  centerOf,
  DIRECTIONS,
  hexDistance,
  hexKey,
  neighborsOf,
  sameHex,
  type Direction,
  type Hex,
} from "./hex";
import { MONSTERS, type MonsterKind } from "./monsters";
import { canSee, SIGHT, visibleFrom } from "./sight";
import type { Lair, Tile } from "./terrain";

export const MAX_HP = 20;
export const PLAYER_DAMAGE = 2;
export const ACTIVE_RADIUS = SIGHT + 4;
export const FORGET_RADIUS = ACTIVE_RADIUS + 8;
const REGEN_INTERVAL = 10;
const LOG_LENGTH = 50;
const PATH_BUDGET = 200;

export interface Land {
  readonly spawn: Hex;
  tileAt(hex: Hex): Tile;
  lairsIn(bounds: Bounds): readonly Lair[];
}

export interface Player {
  readonly at: Hex;
  readonly facing: Direction;
  readonly hp: number;
}

export interface Monster {
  readonly id: string;
  readonly kind: MonsterKind;
  readonly at: Hex;
  readonly hp: number;
}

export interface Game {
  readonly land: Land;
  readonly player: Player;
  readonly monsters: readonly Monster[];
  readonly slain: ReadonlySet<string>;
  readonly seen: ReadonlySet<string>;
  readonly turn: number;
  readonly log: readonly string[];
}

export type Action = Direction | "wait";

export const isOver = (game: Game): boolean => game.player.hp <= 0;

const logged = (game: Game, ...messages: string[]): Game => ({
  ...game,
  log: [...game.log, ...messages].slice(-LOG_LENGTH),
});

export const visibleOf = ({ land, player }: Game): Set<string> =>
  visibleFrom(land.tileAt, player.at, player.facing);

const withSight = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleOf(game)]),
});

const monsterAt = (game: Game, hex: Hex) =>
  game.monsters.find(({ at }) => sameHex(at, hex));

const boundsAround = (hex: Hex, radius: number): Bounds => {
  const { x, y } = centerOf(hex);
  const reach = 2 * radius;
  return { minX: x - reach, minY: y - reach, maxX: x + reach, maxY: y + reach };
};

const populate = (game: Game): Game => {
  const { land, player, slain } = game;
  const kept = game.monsters.filter(
    ({ at }) => hexDistance(at, player.at) <= FORGET_RADIUS,
  );
  const isTaken = (lair: Lair) =>
    slain.has(hexKey(lair.at)) ||
    sameHex(lair.at, player.at) ||
    kept.some(({ id, at }) => id === hexKey(lair.at) || sameHex(at, lair.at));
  const woken = land
    .lairsIn(boundsAround(player.at, ACTIVE_RADIUS))
    .filter(
      (lair) =>
        hexDistance(lair.at, player.at) <= ACTIVE_RADIUS && !isTaken(lair),
    )
    .map(({ kind, at }) => ({
      id: hexKey(at),
      kind,
      at,
      hp: MONSTERS[kind].hp,
    }));
  return { ...game, monsters: [...kept, ...woken] };
};

export const newGame = (land: Land): Game =>
  withSight(
    populate({
      land,
      player: { at: land.spawn, facing: "n", hp: MAX_HP },
      monsters: [],
      slain: new Set(),
      seen: new Set(),
      turn: 0,
      log: ["You set out into the wilds."],
    }),
  );

const attack = (game: Game, target: Monster): Game => {
  const hp = target.hp - PLAYER_DAMAGE;
  if (hp > 0)
    return logged(
      {
        ...game,
        monsters: game.monsters.map((m) => (m === target ? { ...m, hp } : m)),
      },
      `You hit the ${target.kind}.`,
    );
  return logged(
    {
      ...game,
      monsters: game.monsters.filter((m) => m !== target),
      slain: new Set([...game.slain, target.id]),
    },
    `You kill the ${target.kind}.`,
  );
};

const playerTurn = (game: Game, facing: Direction): Game => {
  const to = add(game.player.at, DIRECTIONS[facing]);
  const faced = { ...game, player: { ...game.player, facing } };
  const target = monsterAt(faced, to);
  return target
    ? attack(faced, target)
    : { ...faced, player: { ...faced.player, at: to } };
};

const stepToward = (game: Game, monster: Monster): Hex | undefined => {
  const { land, player } = game;
  const route = findPath({
    start: monster.at,
    isGoal: (hex) => sameHex(hex, player.at),
    neighbors: (hex) =>
      neighborsOf(hex).filter(
        (next) =>
          canStep(land.tileAt, hex, next) &&
          (sameHex(next, player.at) || !monsterAt(game, next)),
      ),
    cost: () => 1,
    heuristic: (hex) => hexDistance(hex, player.at),
    keyOf: hexKey,
    maxExpansions: PATH_BUDGET,
  });
  return "path" in route ? route.path[1] : undefined;
};

const monsterTurn = (game: Game, monster: Monster): Game => {
  const { land, player } = game;
  if (isOver(game)) return game;
  if (
    hexDistance(monster.at, player.at) === 1 &&
    canStep(land.tileAt, monster.at, player.at)
  ) {
    const hp = player.hp - MONSTERS[monster.kind].damage;
    const hit = `The ${monster.kind} hits you.`;
    return logged(
      { ...game, player: { ...player, hp } },
      ...(hp > 0 ? [hit] : [hit, "You die."]),
    );
  }
  if (!canSee(land.tileAt, monster.at, player.at)) return game;
  const step = stepToward(game, monster);
  if (!step || sameHex(step, player.at)) return game;
  return {
    ...game,
    monsters: game.monsters.map((m) =>
      m.id === monster.id ? { ...m, at: step } : m,
    ),
  };
};

const monstersTurn = (game: Game): Game =>
  game.monsters.reduce(
    (state, { id }) =>
      monsterTurn(
        state,
        state.monsters.find((m) => m.id === id)!,
      ),
    game,
  );

const regenerate = (game: Game): Game =>
  game.turn % REGEN_INTERVAL === 0 && !isOver(game)
    ? {
        ...game,
        player: { ...game.player, hp: Math.min(MAX_HP, game.player.hp + 1) },
      }
    : game;

export const act = (game: Game, action: Action): Game => {
  if (isOver(game)) return game;
  const to =
    action === "wait"
      ? game.player.at
      : add(game.player.at, DIRECTIONS[action]);
  if (!canStep(game.land.tileAt, game.player.at, to)) return game;
  const acted = action === "wait" ? game : playerTurn(game, action);
  return withSight(
    populate(regenerate(monstersTurn({ ...acted, turn: game.turn + 1 }))),
  );
};
