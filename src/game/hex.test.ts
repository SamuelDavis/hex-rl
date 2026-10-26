import { describe, expect, test } from "vitest";
import { distance } from "procgen";
import {
  centerOf,
  DIRECTIONS,
  directionBetween,
  hexAt,
  hexDistance,
  hexesWithin,
  lineBetween,
  hexesCovering,
  hexKey,
  neighborsOf,
} from "./hex";

test("six distinct neighbors", () => {
  const keys = neighborsOf({ q: 0, r: 0 }).map(hexKey);
  expect(new Set(keys).size).toBe(6);
});

test("directionBetween names the step to a neighbor, and nothing farther", () => {
  expect(directionBetween({ q: 2, r: 3 }, { q: 3, r: 2 })).toBe("ne");
  expect(directionBetween({ q: 0, r: 0 }, { q: 2, r: 0 })).toBeUndefined();
});

test("neighbor centers are equidistant", () => {
  const origin = centerOf({ q: 0, r: 0 });
  for (const direction of Object.values(DIRECTIONS)) {
    const { x, y } = centerOf(direction);
    expect(distance({ x, y }, origin)).toBeCloseTo(Math.sqrt(3));
  }
});

describe("hexAt", () => {
  test("finds the hex whose center is given", () => {
    const hex = { q: -4, r: 7 };
    expect(hexAt(centerOf(hex))).toEqual(hex);
  });

  test("finds the hex containing a point near its edge", () => {
    const { x, y } = centerOf({ q: 3, r: -1 });
    expect(hexAt({ x: x + 0.8, y: y + 0.1 })).toEqual({ q: 3, r: -1 });
  });
});

test("hexesCovering lists exactly the hexes centered within bounds", () => {
  const bounds = { minX: -3.2, minY: -2.5, maxX: 4.1, maxY: 6 };
  const inside = (hex: { q: number; r: number }) => {
    const { x, y } = centerOf(hex);
    return (
      x >= bounds.minX &&
      x <= bounds.maxX &&
      y >= bounds.minY &&
      y <= bounds.maxY
    );
  };
  const listed = hexesCovering(bounds);
  expect(listed.every(inside)).toBe(true);
  const expected = [];
  for (let q = -10; q <= 10; q++)
    for (let r = -10; r <= 10; r++)
      if (inside({ q, r })) expected.push({ q, r });
  expect(listed.map(hexKey).sort()).toEqual(expected.map(hexKey).sort());
});

describe("hexDistance", () => {
  test("is zero to itself and one to each neighbor", () => {
    const origin = { q: 2, r: -1 };
    expect(hexDistance(origin, origin)).toBe(0);
    for (const neighbor of neighborsOf(origin))
      expect(hexDistance(origin, neighbor)).toBe(1);
  });

  test("counts steps along both axes", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4);
  });
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

test("hexesWithin a radius forms a hexagon of 3r(r+1)+1 hexes", () => {
  expect(hexesWithin(2)).toHaveLength(19);
});
