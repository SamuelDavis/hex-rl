import {
  createWorld,
  defineFields,
  distance,
  expand,
  fbm,
  grid,
  nearestZone,
  projectOntoSegment,
  rngOf,
  simplex2,
  stage,
  type Vec2,
} from "procgen";
import {
  inlandness,
  landformNoise,
  rivers,
  spawnNear,
  terrainOffset,
  type Landform,
  type River,
} from "procgen/recipes";
import { centerOf, hexAt, hexesCovering, hexKey, type Hex } from "./hex";

export const Biome = {
  Ocean: 0,
  Beach: 1,
  Desert: 2,
  Plains: 3,
  Forest: 4,
  Taiga: 5,
  Tundra: 6,
  Mountain: 7,
  Peak: 8,
} as const;
export type Biome = (typeof Biome)[keyof typeof Biome];

export interface Tile {
  readonly ground: number;
  readonly water: number | undefined;
  readonly biome: Biome;
  readonly tree: boolean;
}

export const SEA_LEVEL = 8;
const BLOCKS_PER_ELEVATION = 16;
const BEACH_HEIGHT = 1;
const BEACH_INLANDNESS = 0.4;
const MOUNTAIN_HEIGHT = 11;
const PEAK_HEIGHT = 17;
const LAPSE_PER_BLOCK = 0.03;
const TILES_PER_LANDFORM_UNIT = 0.15;
const CHUNK = 16;

const TREE_DENSITY: Record<Biome, number> = {
  [Biome.Ocean]: 0,
  [Biome.Beach]: 0,
  [Biome.Desert]: 0.01,
  [Biome.Plains]: 0.03,
  [Biome.Forest]: 0.45,
  [Biome.Taiga]: 0.35,
  [Biome.Tundra]: 0.02,
  [Biome.Mountain]: 0.03,
  [Biome.Peak]: 0,
};

export const surfaceOf = ({ ground, water }: Tile): number => water ?? ground;

const climateZoneOf = nearestZone<"temperature" | "humidity", Biome>([
  { zone: Biome.Desert, at: { temperature: [0.3, 1], humidity: [-1, -0.1] } },
  { zone: Biome.Plains, at: { temperature: [-0.1, 1], humidity: [-0.4, 0.1] } },
  { zone: Biome.Forest, at: { temperature: [-0.1, 0.5], humidity: [0.1, 1] } },
  { zone: Biome.Taiga, at: { temperature: [-0.4, -0.1] } },
  { zone: Biome.Tundra, at: { temperature: [-1, -0.4] } },
]);

interface Conditions {
  readonly landform: Landform;
  readonly ground: number;
  readonly temperature: number;
  readonly humidity: number;
  readonly biome: Biome;
}

const waterLevelOf = (
  nearby: readonly River[],
  p: Vec2,
): number | undefined => {
  const levels = nearby.flatMap(({ nodes, lake }) => [
    ...(lake && distance(p, lake) <= lake.radius ? [lake.level] : []),
    ...nodes
      .slice(1)
      .filter(
        (to, i) =>
          projectOntoSegment(p, nodes[i]!, to).distance <= to.halfWidth,
      )
      .map(({ level }) => level),
  ]);
  return levels.length > 0 ? Math.min(...levels) : undefined;
};

const blocksOf = (landform: Landform) =>
  Math.floor((terrainOffset(landform) + 0.5) * BLOCKS_PER_ELEVATION);

export const createTerrain = (seed: number) => {
  const form = landformNoise({ seed, tilesPerUnit: TILES_PER_LANDFORM_UNIT });
  const climate = (name: string, wavelength: number) =>
    fbm(simplex2(rngOf(seed, "climate", name).key), {
      octaves: 3,
      frequency: 1 / wavelength,
    });
  const temperatureNoise = climate("temperature", 400);
  const humidityNoise = climate("humidity", 250);

  const elevationAt = (x: number, y: number) => terrainOffset(form(x, y));
  const groundAt = (x: number, y: number) => blocksOf(form(x, y));

  const conditionsAt = defineFields<[x: number, y: number], Conditions>({
    landform: (_, x, y) => form(x, y),
    ground: (at) => blocksOf(at.landform),
    temperature: (at, x, y) =>
      temperatureNoise(x, y) -
      LAPSE_PER_BLOCK * Math.max(0, at.ground - SEA_LEVEL),
    humidity: (_, x, y) => humidityNoise(x, y),
    biome: (at) => {
      const height = at.ground - SEA_LEVEL;
      if (height < 0) return Biome.Ocean;
      if (height >= PEAK_HEIGHT) return Biome.Peak;
      if (height >= MOUNTAIN_HEIGHT) return Biome.Mountain;
      const zone = climateZoneOf(at);
      return height <= BEACH_HEIGHT &&
        inlandness(at.landform) < BEACH_INLANDNESS &&
        zone !== Biome.Tundra
        ? Biome.Beach
        : zone;
    },
  });

  const waterways = rivers({
    name: "rivers",
    seed,
    drainage: elevationAt,
    ground: (x, y) => Math.max(SEA_LEVEL - 1, groundAt(x, y)),
    rain: (x, y) => 0.5 + humidityNoise(x, y) * 0.8,
    seaLevel: SEA_LEVEL,
    maxGorge: 3,
    cellSize: 24,
    nodeMargin: 4,
    lakeRadii: [3, 6],
    channelMargin: 10,
    maxHalfWidth: 2,
    meanderWavelength: 16,
  });

  const chunks = grid(CHUNK);
  const riversNear = waterways.near(chunks, 1);
  const trees = rngOf(seed, "trees");

  const tileOf = (hex: Hex, nearby: readonly River[]): Tile => {
    const p = centerOf(hex);
    const { ground, biome } = conditionsAt(p.x, p.y);
    const water = waterLevelOf(nearby, p);
    if (water !== undefined)
      return { ground: Math.min(ground, water - 1), water, biome, tree: false };
    if (biome === Biome.Ocean)
      return { ground, water: SEA_LEVEL, biome, tree: false };
    const tree = trees.chance(TREE_DENSITY[biome], hex.q, hex.r);
    return { ground, water: undefined, biome, tree };
  };

  const chunkAt = stage({
    name: "terrain chunks",
    grid: chunks,
    cache: 1024,
    reads: [{ stage: riversNear, radius: 0 }],
    compute: (cell, { read }): ReadonlyMap<string, Tile> => {
      const nearby = read(riversNear, cell);
      const isInCell = (hex: Hex) => {
        const owner = chunks.cellOf(centerOf(hex));
        return owner.col === cell.col && owner.row === cell.row;
      };
      return new Map(
        hexesCovering(expand(chunks.boundsOf(cell), 1))
          .filter(isInCell)
          .map((hex) => [hexKey(hex), tileOf(hex, nearby)]),
      );
    },
  });

  const world = createWorld(seed);
  const tileAt = (hex: Hex): Tile =>
    world.readAt(chunkAt, centerOf(hex)).get(hexKey(hex))!;

  const isSpawnable = (p: Vec2) => {
    const tile = tileAt(hexAt(p));
    return tile.water === undefined && !tile.tree;
  };
  const spawnPoint = spawnNear({
    step: 8,
    maxRadius: 4000,
    isSite: isSpawnable,
  });
  const spawn = hexAt(spawnPoint ?? { x: 0, y: 0 });

  return { chunks, chunkAt, tileAt, spawn };
};

export type Terrain = ReturnType<typeof createTerrain>;
