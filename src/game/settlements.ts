import { rngOf } from "procgen";
import { outpostOf, spawnerIdOf } from "./archetypes";
import { has, type With } from "./components";
import { spawnerHpOf, type SpawnerKind } from "./content/creatures";
import { OUTPOSTS, tierOf } from "./content/settlements";
import {
  add,
  hexDistance,
  hexesWithin,
  neighborsOf,
  sameHex,
  type Hex,
} from "./hex";
import {
  entitiesWith,
  inserted,
  isBlocked,
  occupantAt,
  recorded,
  updated,
  whoIs,
  withOf,
  type Game,
} from "./world";

/** Farthest an outpost is founded from its settlement, in hexes. */
export const OUTPOST_REACH = 6;

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
  return recorded(rehomed(raised, settlement.at, kind), {
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
      const { water, tree } = game.land.tileAt(hex);
      return (
        hexDistance(hex, at) > 1 &&
        water === undefined &&
        !tree &&
        !isBlocked(game, hex) &&
        !neighborsOf(hex).some((next) => isSpawnerAt(game, next))
      );
    });

const unbuiltOf = (game: Game, at: Hex) => {
  const built = new Set(
    entitiesWith(game, "fealty")
      .filter(({ liege }) => sameHex(liege, at))
      .map(({ kind }) => kind),
  );
  return (Object.keys(OUTPOSTS) as SpawnerKind[]).filter(
    (kind) => !built.has(kind),
  );
};

/** Founds one outpost of a kind it lacks, on a site its terrain suits; none if none suits. */
const founded = (game: Game, settlement: Settlement): Game => {
  const { at, townLevel } = settlement;
  const buildable = buildableAround(game, at);
  const options = unbuiltOf(game, at)
    .map((kind) => {
      const suits = OUTPOSTS[kind]!;
      const sites = buildable.filter((site) =>
        [site, ...neighborsOf(site)].some((hex) =>
          suits(game.land.tileAt(hex)),
        ),
      );
      return { kind, sites };
    })
    .filter(({ sites }) => sites.length > 0);
  if (options.length === 0) return game;
  const rng = rngOf(game.land.seed, "outposts");
  const { kind, sites } = rng.pick(options, at.q, at.r, townLevel, 0);
  const site = rng.pick(sites, at.q, at.r, townLevel, 1);
  const outpost = outpostOf({ kind, at: site }, at);
  return recorded(inserted(game, outpost), {
    kind: "founded",
    source: whoIs(game, settlement),
    target: whoIs(game, outpost),
  });
};

/** The settlement at `at` gains a level, rises to its tier and founds an outpost; anything else is unchanged. */
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
  const raised = risen(grew, settlement);
  return founded(raised, settlementAt(raised, at)!);
};
