import { expectOrderIndependent } from "procgen/testing";
import { describe, expect, test } from "vitest";
import {
  add,
  centerOf,
  hexDistance,
  hexesCovering,
  hexesWithin,
  hexKey,
  type Hex,
} from "./hex";
import {
  Biome,
  createTerrain,
  habitatWeightOf,
  SPAWNER_CLEARANCE,
  SEA_LEVEL,
  TOWN_CLEARING,
  surfaceOf,
  WET_REACH,
} from "./terrain";

const SEED = 3;
const terrain = createTerrain(SEED);
const area = hexesCovering({ minX: -300, minY: -300, maxX: 300, maxY: 300 });
const tiles = area.map(terrain.tileAt);

describe("createTerrain", () => {
  test("chunks are independent of generation order", () => {
    expectOrderIndependent({
      seed: SEED,
      stage: terrain.chunkAt,
      cells: terrain.chunks.cellsAround({ col: 0, row: 0 }, 2),
      summary: (chunk) => JSON.stringify([...chunk]),
    });
  });

  test("is a pure function of seed and hex", () => {
    const again = createTerrain(SEED);
    expect(area.slice(0, 500).map(again.tileAt)).toEqual(tiles.slice(0, 500));
  });

  test("covers every hex", () => {
    expect(tiles.every((tile) => tile !== undefined)).toBe(true);
  });

  test("has sea, rivers or lakes, trees and mountains", () => {
    const biomes = new Set(tiles.map(({ biome }) => biome));
    expect(biomes).toContain(Biome.Ocean);
    expect(biomes).toContain(Biome.Mountain);
    expect(
      tiles.some(({ water }) => water !== undefined && water > SEA_LEVEL),
    ).toBe(true);
    expect(tiles.some(({ tree }) => tree)).toBe(true);
  });

  test("marshes are dotted with small pools", () => {
    const marsh = tiles.filter(({ biome }) => biome === Biome.Marsh);
    const pools = marsh.filter(({ water }) => water !== undefined);
    expect(marsh.length).toBeGreaterThan(0);
    expect(pools.length / marsh.length).toBeGreaterThan(0.1);
    expect(pools.length / marsh.length).toBeLessThan(0.5);
  });

  test("heights are whole blocks", () => {
    for (const { ground, water } of tiles) {
      expect(Number.isInteger(ground)).toBe(true);
      if (water !== undefined) expect(Number.isInteger(water)).toBe(true);
    }
  });

  test("water always lies above the ground beneath it", () => {
    for (const tile of tiles)
      if (tile.water !== undefined)
        expect(tile.water).toBeGreaterThan(tile.ground);
  });

  test("spawns on dry, treeless land", () => {
    const tile = terrain.tileAt(terrain.spawn);
    expect(tile.water).toBeUndefined();
    expect(tile.tree).toBe(false);
    expect(surfaceOf(tile)).toBeGreaterThanOrEqual(SEA_LEVEL);
  });

  test("distinct seeds differ", () => {
    const other = createTerrain(SEED + 1);
    expect(area.slice(0, 500).map(other.tileAt)).not.toEqual(
      tiles.slice(0, 500),
    );
  });

  describe("spawners", () => {
    const center = centerOf(terrain.spawn);
    const bounds = {
      minX: center.x - 150,
      maxX: center.x + 150,
      minY: center.y - 150,
      maxY: center.y + 150,
    };
    const spawners = terrain.spawnersIn(bounds);

    test("are scattered across the land", () => {
      expect(spawners.length).toBeGreaterThan(20);
      expect(new Set(spawners.map(({ at }) => hexKey(at))).size).toBe(
        spawners.length,
      );
    });

    test("stand on dry, treeless land away from the spawn", () => {
      for (const { at } of spawners) {
        const tile = terrain.tileAt(at);
        expect(tile.water).toBeUndefined();
        expect(tile.tree).toBe(false);
        expect(hexDistance(at, terrain.spawn)).toBeGreaterThanOrEqual(
          SPAWNER_CLEARANCE,
        );
      }
    });

    test("stand in their habitat", () => {
      for (const { kind, at } of spawners) {
        const isWet = hexesWithin(WET_REACH).some((offset) => {
          const tile = terrain.tileAt(add(at, offset));
          return tile.water !== undefined && tile.biome !== Biome.Ocean;
        });
        expect(
          habitatWeightOf(kind, terrain.tileAt(at).biome, isWet),
        ).toBeGreaterThan(0);
      }
    });

    test("towns sit in a level, dry, treeless clearing, shared where they meet", () => {
      const towns = spawners.filter(({ kind }) => kind === "town");
      expect(towns.length).toBeGreaterThan(0);
      const isNearest = (at: Hex, hex: Hex) =>
        towns.every(
          (other) =>
            other.at === at ||
            hexDistance(other.at, hex) > hexDistance(at, hex),
        );
      for (const { at } of towns) {
        const { ground } = terrain.tileAt(at);
        for (const offset of hexesWithin(TOWN_CLEARING))
          if (isNearest(at, add(at, offset)))
            expect(terrain.tileAt(add(at, offset))).toMatchObject({
              ground,
              water: undefined,
              tree: false,
            });
      }
    });

    test("are a pure function of seed and place", () => {
      expect(createTerrain(SEED).spawnersIn(bounds)).toEqual(spawners);
    });

    test("are independent of generation order", () => {
      expectOrderIndependent({
        seed: SEED,
        stage: terrain.spawnersAt,
        cells: terrain.chunks.cellsAround({ col: 0, row: 0 }, 2),
      });
    });

    test("clearings are independent of generation order", () => {
      expectOrderIndependent({
        seed: SEED,
        stage: terrain.settledAt,
        cells: terrain.chunks.cellsAround({ col: 0, row: 0 }, 2),
        summary: (chunk) => JSON.stringify([...chunk]),
      });
    });
  });
});
