import type { Bounds } from "procgen";
import type { Bounty, Entity } from "./components";
import { bossOf, spawnerOf } from "./content/creatures";
import { centerOf, hexDistance, sameHex, type Hex } from "./hex";
import { dangerOf } from "./terrain";
import { recorded, updated, whoIs, withOf, type Game } from "./world";

export const BOUNTY_GOLD_PER_LEVEL = 25;
/** Radii, in hexes, searched in turn for a lair to post. */
const BOUNTY_SEARCH = [16, 32, 64, 128] as const;

export const boundsAround = (hex: Hex, radius: number): Bounds => {
  const { x, y } = centerOf(hex);
  const reach = 2 * radius;
  return { minX: x - reach, minY: y - reach, maxX: x + reach, maxY: y + reach };
};

/** Marks `hunter`'s bounty slain if `slain` is its boss. */
export const bountyHunted = (
  game: Game,
  hunter: string,
  slain: Entity,
): Game => {
  const questing = withOf(game, hunter, "questing");
  const bounty = questing?.bounty;
  if (
    !questing ||
    !bounty ||
    bounty.isSlain ||
    !slain.home ||
    !sameHex(bounty.at, slain.home.at) ||
    bossOf(bounty.kind) !== slain.kind
  )
    return game;
  return recorded(
    updated(game, hunter, { bounty: { ...bounty, isSlain: true } }),
    {
      kind: "bountySlain",
      source: whoIs(game, questing),
      target: whoIs(game, slain),
    },
  );
};

const rewarded = (
  game: Game,
  hunter: string,
  bounty: Bounty,
  bailiff: Entity,
): Game => {
  const payee = withOf(game, hunter, "purse")!;
  const gold = BOUNTY_GOLD_PER_LEVEL * bounty.level;
  return recorded(
    updated(game, hunter, {
      gold: payee.gold + gold,
      bounty: undefined,
      bountyLevel: bounty.level,
    }),
    {
      kind: "rewarded",
      source: whoIs(game, bailiff),
      target: whoIs(game, payee),
      gold,
    },
  );
};

/** The nearest lair to `from` above `level`, searched in widening rings. */
const lairAbove = ({ land }: Game, from: Hex, level: number) => {
  for (const radius of BOUNTY_SEARCH) {
    const lair = land
      .spawnersIn(boundsAround(from, radius))
      .filter(
        ({ kind, at }) =>
          spawnerOf(kind).faction === "wild" &&
          dangerOf(at, land.spawn) > level &&
          hexDistance(at, from) <= radius,
      )
      .sort((a, b) => hexDistance(a.at, from) - hexDistance(b.at, from))[0];
    if (lair) return lair;
  }
  return undefined;
};

/** Pays `hunter`'s slain bounty, then posts the next if none is outstanding. */
export const bountied = (
  game: Game,
  hunter: string,
  bailiff: Entity & { readonly at: Hex },
): Game => {
  const questing = withOf(game, hunter, "questing", "purse");
  if (!questing) return game;
  const { bounty } = questing;
  if (bounty && !bounty.isSlain) return game;
  const paid = bounty ? rewarded(game, hunter, bounty, bailiff) : game;
  const { bountyLevel } = withOf(paid, hunter, "questing")!;
  const lair = lairAbove(paid, bailiff.at, bountyLevel);
  if (!lair) return paid;
  const level = dangerOf(lair.at, game.land.spawn);
  return recorded(
    updated(paid, hunter, {
      bounty: { kind: lair.kind, at: lair.at, level, isSlain: false },
    }),
    {
      kind: "bountied",
      source: whoIs(game, bailiff),
      target: whoIs(game, questing),
      spawner: lair.kind,
      at: lair.at,
      level,
    },
  );
};
