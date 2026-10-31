import {
  newGame,
  type Intent,
  type Game,
  type Land,
  type Monster,
} from "./game";
import { IDLE } from "./mind";
import { hexKey, type Direction, type Hex } from "./hex";
import { MONSTERS } from "./monsters";
import { SPELL_IDS } from "./abilities";
import { Biome, type Spawner, type Tile } from "./terrain";

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
  spawners: readonly Spawner[] = [],
): Land => ({
  seed: 0,
  spawn: origin,
  tileAt: (hex: Hex) => tiles[hexKey(hex)] ?? land(10),
  spawnersIn: () => spawners,
});

export const monster = (
  at: Hex,
  kind: Monster["kind"] = "goblin",
  facing: Direction = "nw",
  home: Spawner = { kind: "village", at },
): Monster => ({
  id: hexKey(at),
  kind,
  home,
  at,
  facing,
  hp: MONSTERS[kind].hp,
  mind: IDLE,
  level: 1,
  readyAt: 0,
});

const EVERY_SPELL = new Map(SPELL_IDS.map((spell) => [spell, 1]));

/** A player facing south-east who knows every spell at level 1. */
export const facingEast = (world = landOf()): Game => {
  const game = newGame(world);
  return {
    ...game,
    player: { ...game.player, facing: "se", spells: EVERY_SPELL },
  };
};

export const gameWith = (monsters: Monster[], world = landOf()): Game => ({
  ...facingEast(world),
  monsters,
});

export const WAIT: Intent = { kind: "wait" };

export const step = (direction: Direction): Intent => ({
  kind: "move",
  direction,
});
