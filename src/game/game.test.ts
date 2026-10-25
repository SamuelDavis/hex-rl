import { describe, expect, test } from "vitest";
import { act, isOver, MAX_HP, newGame, PLAYER_DAMAGE, type Game } from "./game";
import { hexKey, type Hex } from "./hex";
import { MONSTERS } from "./monsters";

const corridor = (length: number): Hex[] =>
  Array.from({ length }, (_, q) => ({ q, r: 0 }));

const gameIn = (
  floors: readonly Hex[],
  overrides: Partial<Game> = {},
): Game => ({
  seed: 1,
  level: {
    depth: 1,
    floors: new Set(floors.map(hexKey)),
    start: floors[0]!,
    stairs: floors.at(-1)!,
    spawns: [],
  },
  player: { at: floors[0]!, hp: MAX_HP },
  monsters: [],
  seen: new Set(),
  turn: 0,
  log: [],
  ...overrides,
});

describe("newGame", () => {
  test("starts the player on the first level with full health", () => {
    const game = newGame(9);
    expect(game.level.depth).toBe(1);
    expect(game.player).toEqual({ at: game.level.start, hp: MAX_HP });
    expect(game.monsters).toHaveLength(game.level.spawns.length);
    expect(game.seen.has(hexKey(game.level.start))).toBe(true);
  });
});

describe("act", () => {
  test("moving into a wall spends no turn", () => {
    const game = gameIn(corridor(5));
    expect(act(game, "n")).toBe(game);
  });

  test("moving onto floor moves the player and spends a turn", () => {
    const next = act(gameIn(corridor(5)), "se");
    expect(next.player.at).toEqual({ q: 1, r: 0 });
    expect(next.turn).toBe(1);
  });

  test("bumping a monster attacks it", () => {
    const game = gameIn(corridor(5), {
      monsters: [{ id: 0, kind: "orc", at: { q: 1, r: 0 }, hp: 7 }],
    });
    const next = act(game, "se");
    expect(next.player.at).toEqual({ q: 0, r: 0 });
    expect(next.monsters[0]!.hp).toBe(7 - PLAYER_DAMAGE);
  });

  test("a monster at zero health dies", () => {
    const game = gameIn(corridor(5), {
      monsters: [{ id: 0, kind: "rat", at: { q: 1, r: 0 }, hp: 1 }],
    });
    expect(act(game, "se").monsters).toEqual([]);
  });

  test("adjacent monsters attack after the player acts", () => {
    const game = gameIn(corridor(5), {
      monsters: [{ id: 0, kind: "goblin", at: { q: 1, r: 0 }, hp: 4 }],
    });
    expect(act(game, "wait").player.hp).toBe(MAX_HP - MONSTERS.goblin.damage);
  });

  test("distant monsters in sight close in", () => {
    const game = gameIn(corridor(6), {
      monsters: [{ id: 0, kind: "rat", at: { q: 4, r: 0 }, hp: 2 }],
    });
    expect(act(game, "wait").monsters[0]!.at).toEqual({ q: 3, r: 0 });
  });

  test("stepping onto the stairs descends", () => {
    const game = gameIn(corridor(2));
    const next = act(game, "se");
    expect(next.level.depth).toBe(2);
    expect(next.player.at).toEqual(next.level.start);
  });

  test("the game ends when the player dies, and accepts no more actions", () => {
    const game = gameIn(corridor(5), {
      player: { at: { q: 0, r: 0 }, hp: 1 },
      monsters: [{ id: 0, kind: "rat", at: { q: 1, r: 0 }, hp: 2 }],
    });
    const dead = act(game, "wait");
    expect(isOver(dead)).toBe(true);
    expect(act(dead, "se")).toBe(dead);
  });
});
