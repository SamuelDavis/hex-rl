import { expect, test } from "vitest";
import { stepFrom } from "./explorer";
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

test("steps onto level ground", () => {
  expect(stepFrom(tilesOf({}), origin, "se")).toEqual({ q: 1, r: 0 });
});

test("climbs one block", () => {
  expect(stepFrom(tilesOf({ "1,0": land(11) }), origin, "se")).toEqual({
    q: 1,
    r: 0,
  });
});

test("can't climb two blocks", () => {
  expect(stepFrom(tilesOf({ "1,0": land(12) }), origin, "se")).toBe(origin);
});

test("drops any height", () => {
  expect(stepFrom(tilesOf({ "1,0": land(2) }), origin, "se")).toEqual({
    q: 1,
    r: 0,
  });
});

test("swims at the water's surface", () => {
  const lake: Tile = { ground: 4, water: 11, biome: Biome.Plains, tree: false };
  expect(stepFrom(tilesOf({ "1,0": lake }), origin, "se")).toEqual({
    q: 1,
    r: 0,
  });
});
