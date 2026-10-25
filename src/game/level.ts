import { fbm, rngOf, simplex2, type Rng } from "procgen";
import {
  centerOf,
  distancesFrom,
  hexDistance,
  hexesWithin,
  hexKey,
  type Hex,
} from "./hex";
import { monsterWeightsAt, type MonsterKind } from "./monsters";

export const LEVEL_RADIUS = 12;
const MIN_FLOORS = 150;
const OPENNESS = -0.05;
const SPAWN_CLEARANCE = 4;

export interface Spawn {
  readonly kind: MonsterKind;
  readonly at: Hex;
}

export interface Level {
  readonly depth: number;
  readonly floors: ReadonlySet<string>;
  readonly start: Hex;
  readonly stairs: Hex;
  readonly spawns: readonly Spawn[];
}

const HEXES = hexesWithin(LEVEL_RADIUS);
const INTERIOR = HEXES.filter(
  (hex) => hexDistance(hex, { q: 0, r: 0 }) < LEVEL_RADIUS,
);

const carveCaves = (rng: Rng): Hex[] => {
  const noise = fbm(simplex2(rng.u32(0)), { octaves: 3, frequency: 0.18 });
  return INTERIOR.filter((hex) => {
    const { x, y } = centerOf(hex);
    return noise(x, y) > OPENNESS;
  });
};

const largestRegion = (hexes: readonly Hex[]): Hex[] => {
  const open = new Set(hexes.map(hexKey));
  const claimed = new Set<string>();
  let largest: Hex[] = [];
  for (const hex of hexes) {
    if (claimed.has(hexKey(hex))) continue;
    const reached = distancesFrom(hex, (h) => open.has(hexKey(h)));
    const region = hexes.filter((h) => reached.has(hexKey(h)));
    region.forEach((h) => claimed.add(hexKey(h)));
    if (region.length > largest.length) largest = region;
  }
  return largest;
};

const spawnsIn = (
  rng: Rng,
  depth: number,
  candidates: readonly Hex[],
): Spawn[] =>
  rng
    .shuffle(candidates, 1)
    .slice(0, 2 + 2 * depth)
    .map((at, i) => ({
      kind: rng.weighted(monsterWeightsAt(depth), 2, i),
      at,
    }));

export const generateLevel = (
  seed: number,
  depth: number,
  attempt = 0,
): Level => {
  const rng = rngOf(seed, "level", depth, attempt);
  const region = largestRegion(carveCaves(rng));
  if (region.length < MIN_FLOORS)
    return generateLevel(seed, depth, attempt + 1);

  const origin = { q: 0, r: 0 };
  const start = region.reduce((best, hex) =>
    hexDistance(hex, origin) < hexDistance(best, origin) ? hex : best,
  );
  const floors = new Set(region.map(hexKey));
  const distances = distancesFrom(start, (hex) => floors.has(hexKey(hex)));
  const distanceOf = (hex: Hex) => distances.get(hexKey(hex))!;
  const stairs = region.reduce((best, hex) =>
    distanceOf(hex) > distanceOf(best) ? hex : best,
  );
  const candidates = region.filter(
    (hex) => distanceOf(hex) >= SPAWN_CLEARANCE && hex !== stairs,
  );

  return {
    depth,
    floors,
    start,
    stairs,
    spawns: spawnsIn(rng, depth, candidates),
  };
};
