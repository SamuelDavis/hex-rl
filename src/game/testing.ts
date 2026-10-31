import { creatureOf } from "./archetypes";
import { PLAYER, type Entity, type Fields } from "./components";
import { SPELL_IDS } from "./content/abilities";
import type { CreatureKind } from "./content/creatures";
import type { Intent } from "./actions/deeds";
import type { GameEvent, Who } from "./events";
import { hexKey, type Direction, type Hex } from "./hex";
import { newGame } from "./tick";
import { Biome, type Spawner, type Tile } from "./terrain";
import {
  creaturesOf,
  inserted,
  removed,
  updated,
  whoIs,
  type Creature,
  type Game,
  type Land,
} from "./world";

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

/** A creature of `level`, its id its hex, at home on a village where it stands unless given. */
export const creature = (
  at: Hex,
  kind: CreatureKind = "goblin",
  facing: Direction = "nw",
  home: Spawner = { kind: "village", at },
  level = 1,
): Creature =>
  ({
    ...creatureOf(kind, { id: hexKey(at), home, at, facing, level }),
    seq: 0,
  }) as Creature;

const EVERY_SPELL = new Map(SPELL_IDS.map((spell) => [spell, 1]));

export const withPlayer = (game: Game, change: Partial<Fields>): Game =>
  updated(game, PLAYER, change);

/** `game` with exactly `creatures`, spawned in order after everything else. */
export const withCreatures = (game: Game, creatures: readonly Entity[]): Game =>
  creatures.reduce(
    (state, creature) => inserted(state, creature),
    creaturesOf(game).reduce((state, { id }) => removed(state, id), game),
  );

/** A player facing south-east who knows every spell at level 1. */
export const facingEast = (world = landOf()): Game =>
  withPlayer(newGame(world), { facing: "se", abilities: EVERY_SPELL });

export const gameWith = (
  creatures: readonly Entity[],
  world = landOf(),
): Game => withCreatures(facingEast(world), creatures);

export const ADVENTURER: Who = { id: PLAYER, kind: PLAYER, faction: "town" };

/** How events name `creature`, at home on `landOf`'s default plains. */
export const who = (creature: Creature, biome: Biome = Biome.Plains): Who => ({
  ...whoIs({ land: landOf() } as Game, creature),
  biome,
});

/** Events without their causes, for comparing what happened. */
export const eventsOf = ({ events }: Game): readonly GameEvent[] =>
  events.map(
    (event) =>
      Object.fromEntries(
        Object.entries(event).filter(([key]) => key !== "cause"),
      ) as GameEvent,
  );

export const WAIT: Intent = { kind: "wait" };

export const step = (direction: Direction): Intent => ({
  kind: "move",
  direction,
});
