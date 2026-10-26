import { expectOrderIndependent } from "procgen/testing";
import { describe, expect, test } from "vitest";
import { hexesCovering } from "./hex";
import { Biome, createTerrain, SEA_LEVEL, surfaceOf } from "./terrain";

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
});
