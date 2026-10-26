import { expect, test } from "vitest";
import { canStep } from "./explorer";
import { hexKey, type Hex } from "./hex";
import { Biome, type Tile } from "./terrain";

const land = (ground: number): Tile => ({
  ground,
  water: undefined,
  biome: Biome.Plains,
  tree: false,
});

const tilesOf =
  (tiles: Record<string, Tile>, rest = land(10)) =>
  (hex: Hex) =>
    tiles[hexKey(hex)] ?? rest;

const origin = { q: 0, r: 0 };
const east = { q: 1, r: 0 };

test("steps onto level ground", () => {
  expect(canStep(tilesOf({}), origin, east)).toBe(true);
});

test("climbs one block", () => {
  expect(canStep(tilesOf({ "1,0": land(11) }), origin, east)).toBe(true);
});

test("can't climb two blocks", () => {
  expect(canStep(tilesOf({ "1,0": land(12) }), origin, east)).toBe(false);
});

test("drops any height", () => {
  expect(canStep(tilesOf({ "1,0": land(2) }), origin, east)).toBe(true);
});

test("swims at the water's surface", () => {
  const lake: Tile = { ground: 4, water: 11, biome: Biome.Plains, tree: false };
  expect(canStep(tilesOf({ "1,0": lake }), origin, east)).toBe(true);
});
