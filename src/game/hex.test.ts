import { describe, expect, test } from "vitest";
import {
  DIRECTIONS,
  distancesFrom,
  hexDistance,
  hexesWithin,
  hexKey,
  lineBetween,
  neighborsOf,
} from "./hex";

describe("hexDistance", () => {
  test("is zero to itself", () => {
    expect(hexDistance({ q: 2, r: -1 }, { q: 2, r: -1 })).toBe(0);
  });

  test("is one to every neighbor", () => {
    const origin = { q: 0, r: 0 };
    for (const neighbor of neighborsOf(origin))
      expect(hexDistance(origin, neighbor)).toBe(1);
  });

  test("counts steps along both axes", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4);
  });
});

test("six distinct neighbors", () => {
  const keys = neighborsOf({ q: 0, r: 0 }).map(hexKey);
  expect(new Set(keys).size).toBe(6);
  expect(Object.keys(DIRECTIONS)).toHaveLength(6);
});

test("hexesWithin a radius forms a hexagon of 3r(r+1)+1 hexes", () => {
  expect(hexesWithin(2)).toHaveLength(19);
});

describe("lineBetween", () => {
  test("includes both ends, one hex per step", () => {
    const line = lineBetween({ q: 0, r: 0 }, { q: 3, r: -2 });
    expect(line).toHaveLength(4);
    expect(line[0]).toEqual({ q: 0, r: 0 });
    expect(line.at(-1)).toEqual({ q: 3, r: -2 });
  });

  test("each step is adjacent", () => {
    const line = lineBetween({ q: -2, r: 1 }, { q: 3, r: -1 });
    line
      .slice(1)
      .forEach((hex, i) => expect(hexDistance(line[i]!, hex)).toBe(1));
  });
});

test("distancesFrom counts steps through passable hexes only", () => {
  const passable = new Set(["0,0", "1,0", "2,0", "5,5"]);
  const distances = distancesFrom({ q: 0, r: 0 }, (hex) =>
    passable.has(hexKey(hex)),
  );
  expect(Object.fromEntries(distances)).toEqual({
    "0,0": 0,
    "1,0": 1,
    "2,0": 2,
  });
});
