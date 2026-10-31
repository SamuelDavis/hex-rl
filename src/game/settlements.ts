import { rngOf } from "procgen";
import { outpostOf, spawnerIdOf } from "./archetypes";
import { has, type With } from "./components";
import { spawnerHpOf, type SpawnerKind } from "./content/creatures";
import {
  clearingOf,
  hasReached,
  LARGEST_CLEARING,
  OUTPOSTS,
  tierOf,
} from "./content/settlements";
import {
  add,
  hexDistance,
  hexesWithin,
  hexKey,
  neighborsOf,
  sameHex,
  type Hex,
} from "./hex";
import type { Tile } from "./terrain";
import {
  entitiesWith,
  inserted,
  isBlocked,
  occupantAt,
  recorded,
  tileAt,
  updated,
  whoIs,
  withOf,
  type Game,
} from "./world";

/** Farthest an outpost is founded from its settlement, in hexes. */
export const OUTPOST_REACH = 6;
/** Width of the band beyond a clearing whose ground eases back to the land's, in hexes. */
const SMOOTHING = 2;

interface Clearing {
  readonly at: Hex;
  readonly radius: number;
  /** Ground its settlement stands on, which every clearing of it levels to. */
  readonly ground: number;
}

const clearingsNear = (game: Game, at: Hex, reach: number): Clearing[] =>
  entitiesWith(game, "spawning", "position")
    .filter((spawner) => has(spawner, "settlement") || has(spawner, "fealty"))
    .filter((spawner) => hexDistance(spawner.at, at) <= reach)
    .map((spawner) => ({
      at: spawner.at,
      radius: clearingOf(spawner.kind as SpawnerKind),
      ground: game.land.tileAt(spawner.liege ?? spawner.at).ground,
    }));

/** The land's tile under the clearings around: inside one, level and treeless; in the band beyond, eased back toward the land's ground; where several reach, the one whose edge is nearest. Water is never touched. */
const reshapedTile = (
  land: Tile,
  hex: Hex,
  clearings: readonly Clearing[],
): Tile | undefined => {
  if (land.water !== undefined) return undefined;
  const edgeOf = ({ at, radius }: Clearing) => hexDistance(at, hex) - radius;
  const nearest = clearings
    .filter((clearing) => edgeOf(clearing) <= SMOOTHING)
    .sort(
      (a, b) => edgeOf(a) - edgeOf(b) || a.at.q - b.at.q || a.at.r - b.at.r,
    )[0];
  if (!nearest) return undefined;
  const edge = edgeOf(nearest);
  if (edge <= 0) return { ...land, ground: nearest.ground, tree: false };
  const ease = edge / (SMOOTHING + 1);
  const ground = Math.round(
    nearest.ground + (land.ground - nearest.ground) * ease,
  );
  return { ...land, ground };
};

/** Recomputes the ground within `radius` and its smoothing of `at` from every clearing around. */
export const reshaped = (game: Game, at: Hex, radius: number): Game => {
  const reach = radius + SMOOTHING;
  const clearings = clearingsNear(
    game,
    at,
    reach + LARGEST_CLEARING + SMOOTHING,
  );
  const altered = new Map(game.altered);
  for (const offset of hexesWithin(reach)) {
    const hex = add(at, offset);
    const key = hexKey(hex);
    const tile = reshapedTile(game.land.tileAt(hex), hex, clearings);
    if (tile) altered.set(key, tile);
    else altered.delete(key);
  }
  return { ...game, altered };
};

type Settlement = With<"settlement" | "spawning" | "position" | "health">;

const settlementAt = (game: Game, at: Hex): Settlement | undefined =>
  withOf(game, spawnerIdOf(at), "settlement", "spawning", "position", "health");

/** Its folk follow it into its new kind. */
const rehomed = (game: Game, at: Hex, kind: SpawnerKind): Game =>
  entitiesWith(game, "membership")
    .filter(({ home }) => sameHex(home.at, at))
    .reduce(
      (state, { id }) => updated(state, id, { home: { kind, at } }),
      game,
    );

/** Becomes the tier its level calls for, toughened by the difference. */
const risen = (game: Game, settlement: Settlement): Game => {
  const kind = tierOf(settlement.townLevel);
  if (kind === settlement.kind) return game;
  const maxHp = spawnerHpOf(kind);
  const raised = updated(game, settlement.id, {
    kind,
    maxHp,
    hp: settlement.hp + maxHp - settlement.maxHp,
  });
  const cleared = reshaped(raised, settlement.at, clearingOf(kind));
  return recorded(rehomed(cleared, settlement.at, kind), {
    kind: "rose",
    source: whoIs(game, settlement),
    into: kind,
  });
};

const isSpawnerAt = (game: Game, hex: Hex): boolean => {
  const occupant = occupantAt(game, hex);
  return occupant !== undefined && has(occupant, "spawning");
};

/** Free, dry, treeless hexes in reach, none beside a spawner. */
const buildableAround = (game: Game, at: Hex): readonly Hex[] =>
  hexesWithin(OUTPOST_REACH)
    .map((offset) => add(at, offset))
    .filter((hex) => {
      const { water, tree } = tileAt(game, hex);
      return (
        hexDistance(hex, at) > 1 &&
        water === undefined &&
        !tree &&
        !isBlocked(game, hex) &&
        !neighborsOf(hex).some((next) => isSpawnerAt(game, next))
      );
    });

const unbuiltOf = (game: Game, { at, kind: tier }: Settlement) => {
  const built = new Set(
    entitiesWith(game, "fealty")
      .filter(({ liege }) => sameHex(liege, at))
      .map(({ kind }) => kind),
  );
  return (Object.keys(OUTPOSTS) as SpawnerKind[]).filter((kind) => {
    const { needs } = OUTPOSTS[kind]!;
    return (
      !built.has(kind) && (!needs || hasReached(tier as SpawnerKind, needs))
    );
  });
};

/** Founds one outpost of a kind it lacks, on a site its terrain suits; none if none suits. */
const founded = (game: Game, settlement: Settlement): Game => {
  const { at, townLevel } = settlement;
  const buildable = buildableAround(game, at);
  const options = unbuiltOf(game, settlement)
    .map((kind) => {
      const { suits } = OUTPOSTS[kind]!;
      const sites = buildable.filter((site) =>
        [site, ...neighborsOf(site)].some((hex) => suits(tileAt(game, hex))),
      );
      return { kind, sites };
    })
    .filter(({ sites }) => sites.length > 0);
  if (options.length === 0) return game;
  const rng = rngOf(game.land.seed, "outposts");
  const { kind, sites } = rng.pick(options, at.q, at.r, townLevel, 0);
  const site = rng.pick(sites, at.q, at.r, townLevel, 1);
  const outpost = outpostOf({ kind, at: site }, at);
  const built = reshaped(inserted(game, outpost), site, clearingOf(kind));
  return recorded(built, {
    kind: "founded",
    source: whoIs(game, settlement),
    target: whoIs(game, outpost),
  });
};

/** The settlement at `at` gains a level, founds an outpost, then rises to its tier; anything else is unchanged. */
export const grown = (game: Game, at: Hex): Game => {
  const before = settlementAt(game, at);
  if (!before) return game;
  const level = before.townLevel + 1;
  const leveled = updated(game, before.id, { townLevel: level });
  const settlement = settlementAt(leveled, at)!;
  const grew = recorded(leveled, {
    kind: "grew",
    source: whoIs(leveled, settlement),
    level,
  });
  const built = founded(grew, settlement);
  return risen(built, settlementAt(built, at)!);
};
