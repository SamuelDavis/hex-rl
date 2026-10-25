import { findPath } from "procgen";
import {
  add,
  DIRECTIONS,
  hexDistance,
  hexesWithin,
  hexKey,
  lineBetween,
  neighborsOf,
  sameHex,
  type Direction,
  type Hex,
} from "./hex";
import { generateLevel, type Level } from "./level";
import { MONSTERS, type MonsterKind } from "./monsters";

export const MAX_HP = 20;
export const PLAYER_DAMAGE = 2;
export const SIGHT = 7;
const REGEN_INTERVAL = 10;
const LOG_LENGTH = 5;
const PATH_BUDGET = 200;

export interface Player {
  readonly at: Hex;
  readonly hp: number;
}

export interface Monster {
  readonly id: number;
  readonly kind: MonsterKind;
  readonly at: Hex;
  readonly hp: number;
}

export interface Game {
  readonly seed: number;
  readonly level: Level;
  readonly player: Player;
  readonly monsters: readonly Monster[];
  readonly seen: ReadonlySet<string>;
  readonly turn: number;
  readonly log: readonly string[];
}

export type Action = Direction | "wait";

const isFloor = (level: Level, hex: Hex) => level.floors.has(hexKey(hex));

const SIGHT_OFFSETS = hexesWithin(SIGHT);

const canSee = (level: Level, eye: Hex, target: Hex) =>
  hexDistance(eye, target) <= SIGHT &&
  lineBetween(eye, target)
    .slice(1, -1)
    .every((hex) => isFloor(level, hex));

export const visibleFrom = (level: Level, eye: Hex): Set<string> =>
  new Set(
    SIGHT_OFFSETS.map((offset) => add(eye, offset))
      .filter((target) => canSee(level, eye, target))
      .map(hexKey),
  );

const withSight = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleFrom(game.level, game.player.at)]),
});

const logged = (game: Game, ...messages: string[]): Game => ({
  ...game,
  log: [...game.log, ...messages].slice(-LOG_LENGTH),
});

const enter = (game: Game, level: Level): Game =>
  withSight({
    ...game,
    level,
    player: { ...game.player, at: level.start },
    monsters: level.spawns.map(({ kind, at }, id) => ({
      id,
      kind,
      at,
      hp: MONSTERS[kind].hp,
    })),
    seen: new Set(),
  });

export const newGame = (seed: number): Game => {
  const level = generateLevel(seed, 1);
  return enter(
    {
      seed,
      level,
      player: { at: level.start, hp: MAX_HP },
      monsters: [],
      seen: new Set(),
      turn: 0,
      log: ["You enter the caves. Find the stairs (>)."],
    },
    level,
  );
};

export const isOver = (game: Game): boolean => game.player.hp <= 0;

const monsterAt = (game: Game, hex: Hex) =>
  game.monsters.find(({ at }) => sameHex(at, hex));

const attack = (game: Game, target: Monster): Game => {
  const hp = target.hp - PLAYER_DAMAGE;
  const name = target.kind;
  return hp > 0
    ? logged(
        {
          ...game,
          monsters: game.monsters.map((m) => (m === target ? { ...m, hp } : m)),
        },
        `You hit the ${name}.`,
      )
    : logged(
        { ...game, monsters: game.monsters.filter((m) => m !== target) },
        `You kill the ${name}.`,
      );
};

const playerTurn = (game: Game, action: Action): Game => {
  if (action === "wait") return game;
  const destination = add(game.player.at, DIRECTIONS[action]);
  const target = monsterAt(game, destination);
  if (target) return attack(game, target);
  return { ...game, player: { ...game.player, at: destination } };
};

const stepToward = (game: Game, monster: Monster): Hex | undefined => {
  const route = findPath({
    start: monster.at,
    isGoal: (hex) => sameHex(hex, game.player.at),
    neighbors: (hex) =>
      neighborsOf(hex).filter(
        (next) =>
          isFloor(game.level, next) &&
          (sameHex(next, game.player.at) || !monsterAt(game, next)),
      ),
    cost: () => 1,
    heuristic: (hex) => hexDistance(hex, game.player.at),
    keyOf: hexKey,
    maxExpansions: PATH_BUDGET,
  });
  return "path" in route ? route.path[1] : undefined;
};

const monsterTurn = (game: Game, monster: Monster): Game => {
  if (isOver(game)) return game;
  if (hexDistance(monster.at, game.player.at) === 1) {
    const { damage } = MONSTERS[monster.kind];
    const hp = game.player.hp - damage;
    const hit = `The ${monster.kind} hits you.`;
    return logged(
      { ...game, player: { ...game.player, hp } },
      ...(hp > 0 ? [hit] : [hit, "You die."]),
    );
  }
  if (!canSee(game.level, monster.at, game.player.at)) return game;
  const step = stepToward(game, monster);
  if (!step || sameHex(step, game.player.at)) return game;
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
        player: {
          ...game.player,
          hp: Math.min(MAX_HP, game.player.hp + 1),
        },
      }
    : game;

const isBlocked = (game: Game, action: Action) =>
  action !== "wait" &&
  !isFloor(game.level, add(game.player.at, DIRECTIONS[action]));

export const act = (game: Game, action: Action): Game => {
  if (isOver(game) || isBlocked(game, action)) return game;
  const acted = { ...playerTurn(game, action), turn: game.turn + 1 };
  if (sameHex(acted.player.at, acted.level.stairs)) {
    const depth = acted.level.depth + 1;
    return logged(
      enter(acted, generateLevel(acted.seed, depth)),
      `You descend to depth ${depth}.`,
    );
  }
  return withSight(regenerate(monstersTurn(acted)));
};
