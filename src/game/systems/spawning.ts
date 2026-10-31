import { rngOf, type Rng } from "procgen";
import { creatureOf, facingAt, spawnerIdOf } from "../archetypes";
import type { EntityId, With } from "../components";
import {
  bossOf,
  spawnerOf,
  type CreatureKind,
  type SpawnerKind,
} from "../content/creatures";
import { relationOf } from "../content/factions";
import { hexDistance, hexKey, sameHex, type Hex } from "../hex";
import { IDLE, sighted } from "../mind";
import { dangerOf, type Spawner } from "../terrain";
import {
  entitiesWith,
  inserted,
  recorded,
  sitesAround,
  updated,
  whoIs,
  withOf,
  type Game,
} from "../world";

type SpawnerEntity = With<"spawning" | "position" | "health" | "allegiance">;

const spawnerOfEntity = ({ kind, at }: SpawnerEntity): Spawner => ({
  kind: kind as SpawnerKind,
  at,
});

const isUnhealed = (spawner: SpawnerEntity): boolean =>
  spawner.isWrecked && spawner.hp < spawner.maxHp;

/** Whether `spawner` is wrecked and not yet healed. */
export const isWrecked = (game: Game, { at }: Spawner): boolean => {
  const spawner = withOf(
    game,
    spawnerIdOf(at),
    "spawning",
    "position",
    "health",
    "allegiance",
  );
  return spawner !== undefined && isUnhealed(spawner);
};

const spawnSiteOf = (game: Game, at: Hex): Hex | undefined => {
  const sites = sitesAround(game, at);
  if (sites.length === 0) return undefined;
  return rngOf(game.land.seed, "spawns").pick(sites, at.q, at.r, game.turn, 3);
};

const spawned = (game: Game, home: Spawner, kind: CreatureKind, at: Hex) =>
  creatureOf(kind, {
    id: `${hexKey(home.at)}@${game.turn}`,
    home,
    at,
    facing: facingAt(game.land.seed, at, game.turn),
    level: dangerOf(home.at, game.land.spawn),
  });

/** The nearest hostile agent to `from`, for a boss to rush. */
const quarryOf = (game: Game, spawner: SpawnerEntity) =>
  entitiesWith(game, "agent", "position", "allegiance", "health")
    .filter(
      ({ faction, hp }) =>
        hp > 0 && relationOf(faction, spawner.faction) === "hostile",
    )
    .sort(
      (a, b) => hexDistance(a.at, spawner.at) - hexDistance(b.at, spawner.at),
    )[0];

/** Its boss emerges, hostile toward the nearest foe, once a hex beside it is free. */
const unleashBoss = (game: Game, spawner: SpawnerEntity): Game => {
  const home = spawnerOfEntity(spawner);
  const boss = bossOf(home.kind);
  const site = spawnSiteOf(game, home.at);
  if (!boss || !site) return game;
  const creature = spawned(game, home, boss, site);
  const quarry = quarryOf(game, spawner);
  const hostile = quarry
    ? { ...creature, mind: sighted(IDLE, site, quarry) }
    : creature;
  return recorded(
    updated(inserted(game, hostile), spawner.id, { isBossDue: false }),
    { kind: "emerged", source: whoIs(game, hostile) },
  );
};

/** The kind `spawner` would spawn now, if it has room for one. */
const recruitOf = (
  game: Game,
  { kind, at }: Spawner,
  rng: Rng,
): CreatureKind | undefined => {
  const members = entitiesWith(game, "membership").filter(({ home }) =>
    sameHex(home.at, at),
  );
  const type = spawnerOf(kind);
  if (type.faction === "wild")
    return members.length < type.cap
      ? rng.weighted(type.pool, at.q, at.r, game.turn, 1)
      : undefined;
  return type.roster.find(
    ([recruit, count]) =>
      members.filter((member) => member.kind === recruit).length < count,
  )?.[0];
};

/** Spawns one member when its timer and chance allow, or at once on healing from a wreck. */
const spawnFrom = (game: Game, spawner: SpawnerEntity): Game => {
  if (spawner.isBossDue) return unleashBoss(game, spawner);
  const home = spawnerOfEntity(spawner);
  const { at } = home;
  const { interval, chance } = spawnerOf(home.kind);
  const rng = rngOf(game.land.seed, "spawns");
  const site = spawnSiteOf(game, at);
  const recruit = recruitOf(game, home, rng);
  if (isUnhealed(spawner) || !site || !recruit) return game;
  const isRevived = spawner.isWrecked;
  if (
    !isRevived &&
    (game.turn < spawner.spawnsAt || !rng.chance(chance, at.q, at.r, game.turn))
  )
    return game;
  return updated(
    inserted(game, spawned(game, home, recruit, site)),
    spawner.id,
    {
      spawnsAt: game.turn + interval,
      isWrecked: false,
    },
  );
};

/** A spawner's turn: it may spawn, or unleash its boss. */
export const spawning = (game: Game, id: EntityId): Game => {
  const spawner = withOf(
    game,
    id,
    "spawning",
    "position",
    "health",
    "allegiance",
  );
  return spawner ? spawnFrom(game, spawner) : game;
};
