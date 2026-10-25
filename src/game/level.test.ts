import { describe, expect, test } from "vitest";
import { distancesFrom, hexKey, sameHex } from "./hex";
import { generateLevel } from "./level";

const SEEDS = [1, 2, 3, 42, 1337];

describe("generateLevel", () => {
  test("is a pure function of seed and depth", () => {
    expect(generateLevel(7, 2)).toEqual(generateLevel(7, 2));
  });

  test("differs between seeds and depths", () => {
    expect(generateLevel(7, 1).floors).not.toEqual(generateLevel(8, 1).floors);
    expect(generateLevel(7, 1).floors).not.toEqual(generateLevel(7, 2).floors);
  });

  test.each(SEEDS)(
    "seed %i: every floor is reachable from the start",
    (seed) => {
      const level = generateLevel(seed, 1);
      const reachable = distancesFrom(level.start, (hex) =>
        level.floors.has(hexKey(hex)),
      );
      expect(reachable.size).toBe(level.floors.size);
    },
  );

  test.each(SEEDS)(
    "seed %i: stairs and spawns stand on distinct floors away from the start",
    (seed) => {
      const level = generateLevel(seed, 3);
      const occupied = [level.stairs, ...level.spawns.map(({ at }) => at)];
      for (const hex of occupied) {
        expect(level.floors.has(hexKey(hex))).toBe(true);
        expect(sameHex(hex, level.start)).toBe(false);
      }
      expect(new Set(level.spawns.map(({ at }) => hexKey(at))).size).toBe(
        level.spawns.length,
      );
    },
  );

  test("deeper levels spawn more monsters", () => {
    expect(generateLevel(1, 5).spawns.length).toBeGreaterThan(
      generateLevel(1, 1).spawns.length,
    );
  });
});
