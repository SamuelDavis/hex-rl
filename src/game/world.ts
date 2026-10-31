import type { Bounds } from "procgen";
import {
  has,
  PLAYER,
  type ComponentName,
  type Entity,
  type EntityId,
  type Fields,
  type With,
} from "./components";
import type { Cause, GameEvent, Who } from "./events";
import { canStep } from "./explorer";
import { directionBetween, hexKey, neighborsOf, type Hex } from "./hex";
import type { CreatureKind } from "./content/creatures";
import type { Chest } from "./items";
import type { Spawner, Tile } from "./terrain";

export interface Land {
  readonly seed: number;
  readonly spawn: Hex;
  tileAt(hex: Hex): Tile;
  spawnersIn(bounds: Bounds): readonly Spawner[];
}

/** The whole simulation state: plain data, so it can be sent between peers. */
export interface Game {
  readonly land: Land;
  /** In spawn order, which is turn order. */
  readonly entities: ReadonlyMap<EntityId, Entity>;
  /** The entity at each hex key; at most one stands on a hex. */
  readonly occupants: ReadonlyMap<string, EntityId>;
  /** The last `seq` given. */
  readonly seq: number;
  /** What lies on the ground, by hex key; a chest is never empty. */
  readonly chests: ReadonlyMap<string, Chest>;
  /** Hexes the player has seen, by key. */
  readonly seen: ReadonlySet<string>;
  readonly turn: number;
  /** What the action that produced this state did, in order. */
  readonly events: readonly GameEvent[];
}

export const emptyGame = (land: Land): Game => ({
  land,
  entities: new Map(),
  occupants: new Map(),
  seq: 0,
  chests: new Map(),
  seen: new Set(),
  turn: 0,
  events: [],
});

/** `id`, if it exists and has every component named. */
export const withOf = <K extends ComponentName>(
  game: Game,
  id: EntityId,
  ...components: readonly K[]
): With<K> | undefined => {
  const entity = game.entities.get(id);
  return entity && has(entity, ...components) ? entity : undefined;
};

export const entitiesWith = <K extends ComponentName>(
  game: Game,
  ...components: readonly K[]
): readonly With<K>[] =>
  [...game.entities.values()].filter((entity): entity is With<K> =>
    has(entity, ...components),
  );

export const occupantAt = (game: Game, hex: Hex): Entity | undefined => {
  const id = game.occupants.get(hexKey(hex));
  return id === undefined ? undefined : game.entities.get(id);
};

export const isBlocked = (game: Game, hex: Hex): boolean =>
  game.occupants.has(hexKey(hex));

/** Whether a step from `from` could reach `to`, ignoring who stands there. */
export const isInReach = ({ land }: Game, from: Hex, to: Hex): boolean =>
  canStep(land.tileAt, from, to);

export const isBeside = (game: Game, from: Hex, to: Hex): boolean =>
  directionBetween(from, to) !== undefined && isInReach(game, from, to);

/** Free hexes a step from `at`. */
export const sitesAround = (game: Game, at: Hex): Hex[] =>
  neighborsOf(at).filter(
    (next) => isInReach(game, at, next) && !isBlocked(game, next),
  );

const occupied = (
  occupants: ReadonlyMap<string, EntityId>,
  before: Entity | undefined,
  after: Entity | undefined,
): ReadonlyMap<string, EntityId> => {
  if (before?.at === after?.at) return occupants;
  const next = new Map(occupants);
  if (before?.at) next.delete(hexKey(before.at));
  if (after?.at) next.set(hexKey(after.at), after.id);
  return next;
};

/** Adds `entity` last in turn order. */
export const inserted = (game: Game, entity: Omit<Entity, "seq">): Game => {
  const seq = game.seq + 1;
  const added = { ...entity, seq } as Entity;
  return {
    ...game,
    seq,
    entities: new Map([...game.entities, [added.id, added]]),
    occupants: occupied(game.occupants, undefined, added),
  };
};

export const updated = (
  game: Game,
  id: EntityId,
  change: Partial<Fields>,
): Game => {
  const before = game.entities.get(id);
  if (!before) return game;
  const after = { ...before, ...change };
  return {
    ...game,
    entities: new Map(game.entities).set(id, after),
    occupants: occupied(game.occupants, before, after),
  };
};

export const removed = (game: Game, id: EntityId): Game => {
  const before = game.entities.get(id);
  if (!before) return game;
  const entities = new Map(game.entities);
  entities.delete(id);
  return {
    ...game,
    entities,
    occupants: occupied(game.occupants, before, undefined),
  };
};

export const recorded = (game: Game, ...events: GameEvent[]): Game => ({
  ...game,
  events: [...game.events, ...events],
});

/** Stamps `cause` on the events `produce` records that have none yet. */
export const caused = (
  game: Game,
  cause: Cause,
  produce: (game: Game) => Game,
): Game => {
  const next = produce(game);
  const from = game.events.length;
  if (next.events.length === from) return next;
  return {
    ...next,
    events: next.events.map((event, i) =>
      i < from || event.cause ? event : { ...event, cause },
    ),
  };
};

export const whoIs = ({ land }: Game, entity: Omit<Entity, "seq">): Who => {
  const home =
    entity.home?.at ?? (entity.spawnsAt === undefined ? undefined : entity.at);
  return {
    id: entity.id,
    kind: entity.kind,
    faction: entity.faction ?? "wild",
    ...(home && { biome: land.tileAt(home).biome }),
  };
};

export const whoOf = (game: Game, id: EntityId): Who =>
  whoIs(game, game.entities.get(id)!);

export type Player = With<
  | "position"
  | "health"
  | "mana"
  | "conditions"
  | "allegiance"
  | "agent"
  | "caster"
  | "stats"
  | "inventory"
  | "purse"
  | "progression"
  | "questing"
>;

export type Creature = With<
  | "position"
  | "health"
  | "conditions"
  | "allegiance"
  | "agent"
  | "mind"
  | "membership"
  | "caster"
  | "stats"
> & { readonly kind: CreatureKind };

/** The local seat's entity. */
export const playerOf = (game: Game): Player =>
  game.entities.get(PLAYER) as Player;

/** Entities that choose their own actions. */
export const creaturesOf = (game: Game): readonly Creature[] =>
  entitiesWith(game, "mind") as readonly Creature[];

export const isOver = (game: Game): boolean => playerOf(game).hp <= 0;
