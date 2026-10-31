import { rngOf, type Rng } from "procgen";
import { creatureOf, facingAt, spawnerIdOf } from "../archetypes";
import { has, type With } from "../components";
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
import { performed, refused, type Rule, type Spawn } from "./deeds";

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

/** The nearest hostile fighter, for a boss to rush. */
const quarryOf = (game: Game, spawner: SpawnerEntity) =>
  entitiesWith(game, "agent", "stats", "position", "allegiance", "health")
    .filter(
      ({ faction, hp }) =>
        hp > 0 && relationOf(faction, spawner.faction) === "hostile",
    )
    .sort(
      (a, b) => hexDistance(a.at, spawner.at) - hexDistance(b.at, spawner.at),
    )[0];

const membersOf = (game: Game, { at }: Spawner) =>
  entitiesWith(game, "membership").filter(({ home }) => sameHex(home.at, at));

/** Its boss emerges beside it: roused by a wreck, hostile toward the nearest fighting foe; else idle. */
const bossEmerged = (game: Game, spawner: SpawnerEntity, site: Hex): Game => {
  const home = spawnerOfEntity(spawner);
  const creature = spawned(game, home, bossOf(home.kind), site);
  const quarry = spawner.isBossDue ? quarryOf(game, spawner) : undefined;
  const boss = quarry
    ? { ...creature, mind: sighted(IDLE, site, quarry) }
    : creature;
  return recorded(
    updated(inserted(game, boss), spawner.id, { isBossDue: false }),
    { kind: "emerged", source: whoIs(game, boss) },
  );
};

/** The recruit its strategy calls for now, if it has room for one. */
const recruitOf = (
  game: Game,
  home: Spawner,
  rng: Rng,
): CreatureKind | undefined => {
  const { recruits, boss } = spawnerOf(home.kind);
  const members = membersOf(game, home).filter(
    ({ kind }) => kind !== boss.kind,
  );
  const { at } = home;
  switch (recruits.kind) {
    case "pool":
      return members.length < recruits.cap
        ? rng.weighted(recruits.pool, at.q, at.r, game.turn, 1)
        : undefined;
    case "roster":
      return recruits.roster.find(
        ([recruit, count]) =>
          members.filter((member) => member.kind === recruit).length < count,
      )?.[0];
  }
};

/** Its boss, if called for (`always`, or roused by a wreck) and none is alive: it comes before any recruit, at once. */
const isBossCalled = (
  game: Game,
  spawner: SpawnerEntity,
  home: Spawner,
): boolean => {
  const { boss } = spawnerOf(home.kind);
  const isAlive = membersOf(game, home).some(({ kind }) => kind === boss.kind);
  return !isAlive && (boss.spawns === "always" || spawner.isBossDue);
};

/** By its strategy: its boss when called for, at once; a wreck's rousing spent if its boss already lives; else a recruit when its timer and chance allow, or at once on healing from a wreck. */
export const spawn: Rule<Spawn> = (game, _, actor) => {
  if (!has(actor, "spawning", "position", "health", "allegiance"))
    return refused("unable");
  const home = spawnerOfEntity(actor);
  const { at } = home;
  const site = spawnSiteOf(game, at);
  if (isBossCalled(game, actor, home))
    return site
      ? performed(bossEmerged(game, actor, site))
      : refused("blocked");
  if (actor.isBossDue)
    return performed(updated(game, actor.id, { isBossDue: false }));
  if (isUnhealed(actor)) return refused("not-ready");
  if (!site) return refused("blocked");
  const { interval, chance } = spawnerOf(home.kind);
  const rng = rngOf(game.land.seed, "spawns");
  const recruit = recruitOf(game, home, rng);
  if (!recruit) return refused("full");
  const isDue =
    actor.isWrecked ||
    (game.turn >= actor.spawnsAt && rng.chance(chance, at.q, at.r, game.turn));
  if (!isDue) return refused("not-ready");
  return performed(
    updated(inserted(game, spawned(game, home, recruit, site)), actor.id, {
      spawnsAt: game.turn + interval,
      isWrecked: false,
    }),
  );
};
