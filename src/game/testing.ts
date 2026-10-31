import {
  factionOfCreature,
  newGame,
  PLAYER,
  type Who,
  type Intent,
  type Game,
  type Land,
  type Creature,
} from "./game";
import { IDLE } from "./mind";
import { hexKey, type Direction, type Hex } from "./hex";
import { CREATURES } from "./creatures";
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

export const creature = (
  at: Hex,
  kind: Creature["kind"] = "goblin",
  facing: Direction = "nw",
  home: Spawner = { kind: "village", at },
): Creature => ({
  id: hexKey(at),
  kind,
  home,
  at,
  facing,
  hp: CREATURES[kind].hp,
  mind: IDLE,
  level: 1,
  readyAt: 0,
  wares: [],
  purse: 0,
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

export const gameWith = (creatures: Creature[], world = landOf()): Game => ({
  ...facingEast(world),
  creatures,
});

export const ADVENTURER: Who = { id: PLAYER, kind: PLAYER, faction: "town" };

/** How events name `creature`, at home on `landOf`'s default plains. */
export const who = (creature: Creature, biome: Biome = Biome.Plains): Who => ({
  id: creature.id,
  kind: creature.kind,
  faction: factionOfCreature(creature),
  biome,
});

export const WAIT: Intent = { kind: "wait" };

export const step = (direction: Direction): Intent => ({
  kind: "move",
  direction,
});
