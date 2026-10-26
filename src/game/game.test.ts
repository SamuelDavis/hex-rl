import { describe, expect, test } from "vitest";
import {
  act,
  ACTIVE_RADIUS,
  FORGET_RADIUS,
  isOver,
  MAX_HP,
  newGame,
  PLAYER_DAMAGE,
  type Game,
  type Land,
  type Monster,
} from "./game";
import { hexKey, type Hex } from "./hex";
import { MONSTERS } from "./monsters";
import { Biome, type Lair, type Tile } from "./terrain";

const land = (ground: number, tree = false): Tile => ({
  ground,
  water: undefined,
  biome: Biome.Plains,
  tree,
});

const origin = { q: 0, r: 0 };
const east = { q: 1, r: 0 };

const landOf = (
  tiles: Record<string, Tile> = {},
  lairs: readonly Lair[] = [],
): Land => ({
  spawn: origin,
  tileAt: (hex: Hex) => tiles[hexKey(hex)] ?? land(10),
  lairsIn: () => lairs,
});

const monster = (at: Hex, kind: Monster["kind"] = "goblin"): Monster => ({
  id: hexKey(at),
  kind,
  at,
  hp: MONSTERS[kind].hp,
});

const gameWith = (monsters: Monster[], world = landOf()): Game => ({
  ...newGame(world),
  monsters,
});

describe("newGame", () => {
  test("starts at the spawn with full health", () => {
    const game = newGame(landOf());
    expect(game.player).toEqual({ at: origin, hp: MAX_HP });
    expect(game.seen.has(hexKey(origin))).toBe(true);
  });

  test("wakes the lairs within the active radius only", () => {
    const near = { kind: "wolf", at: { q: ACTIVE_RADIUS, r: 0 } } as const;
    const far = { kind: "wolf", at: { q: ACTIVE_RADIUS + 1, r: 0 } } as const;
    const game = newGame(landOf({}, [near, far]));
    expect(game.monsters.map(({ at }) => at)).toEqual([near.at]);
  });
});

describe("act", () => {
  test("a step too high to climb spends no turn", () => {
    const game = newGame(landOf({ "1,0": land(12) }));
    expect(act(game, "se")).toBe(game);
  });

  test("a step onto level ground moves and spends a turn", () => {
    const next = act(newGame(landOf()), "se");
    expect(next.player.at).toEqual(east);
    expect(next.turn).toBe(1);
  });

  test("bumping a monster attacks it", () => {
    const next = act(gameWith([monster(east, "troll")]), "se");
    expect(next.player.at).toEqual(origin);
    expect(next.monsters[0]!.hp).toBe(MONSTERS.troll.hp - PLAYER_DAMAGE);
  });

  test("a slain monster stays slain", () => {
    const lair = { kind: "wolf", at: east } as const;
    const world = landOf({}, [lair]);
    const game = { ...newGame(world), monsters: [{ ...monster(east), hp: 1 }] };
    const next = act(game, "se");
    expect(next.monsters).toEqual([]);
    expect(act(next, "wait").monsters).toEqual([]);
  });

  test("adjacent monsters attack after the player acts", () => {
    const next = act(gameWith([monster(east)]), "wait");
    expect(next.player.hp).toBe(MAX_HP - MONSTERS.goblin.damage);
  });

  test("monsters can't strike up a cliff", () => {
    const world = landOf({ "1,0": land(4) });
    expect(act(gameWith([monster(east)], world), "wait").player.hp).toBe(
      MAX_HP,
    );
  });

  test("monsters in sight close in", () => {
    const next = act(gameWith([monster({ q: 4, r: 0 })]), "wait");
    expect(next.monsters[0]!.at).toEqual({ q: 3, r: 0 });
  });

  test("monsters out of sight stay put", () => {
    const world = landOf({ "2,0": land(10, true) });
    const next = act(gameWith([monster({ q: 4, r: 0 })], world), "wait");
    expect(next.monsters[0]!.at).toEqual({ q: 4, r: 0 });
  });

  test("monsters beyond the forget radius are forgotten", () => {
    const far = monster({ q: FORGET_RADIUS + 1, r: 0 });
    expect(act(gameWith([far]), "wait").monsters).toEqual([]);
  });

  test("the game ends when the player dies, and accepts no more actions", () => {
    const game = {
      ...gameWith([monster(east)]),
      player: { at: origin, hp: 1 },
    };
    const dead = act(game, "wait");
    expect(isOver(dead)).toBe(true);
    expect(act(dead, "se")).toBe(dead);
  });
});
