import { newGame, type Game, type Land, type Monster } from "./game";
import { hexKey, type Direction, type Hex } from "./hex";
import { MONSTERS } from "./monsters";
import { Biome, type Lair, type Tile } from "./terrain";

export const land = (ground: number, tree = false): Tile => ({
  ground,
  water: undefined,
  biome: Biome.Plains,
  tree,
});

export const origin = { q: 0, r: 0 };
export const east = { q: 1, r: 0 };

export const landOf = (
  tiles: Record<string, Tile> = {},
  lairs: readonly Lair[] = [],
): Land => ({
  spawn: origin,
  tileAt: (hex: Hex) => tiles[hexKey(hex)] ?? land(10),
  lairsIn: () => lairs,
});

export const monster = (
  at: Hex,
  kind: Monster["kind"] = "goblin",
  facing: Direction = "nw",
): Monster => ({
  id: hexKey(at),
  kind,
  at,
  facing,
  hp: MONSTERS[kind].hp,
});

export const facingEast = (world = landOf()): Game => {
  const game = newGame(world);
  return { ...game, player: { ...game.player, facing: "se" } };
};

export const gameWith = (monsters: Monster[], world = landOf()): Game => ({
  ...facingEast(world),
  monsters,
});
