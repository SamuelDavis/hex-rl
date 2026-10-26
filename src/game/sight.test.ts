import { expect, test } from "vitest";
import { hexKey, type Hex } from "./hex";
import { canSee, SIGHT, visibleFrom } from "./sight";
import { Biome, type Tile } from "./terrain";

const land = (ground: number, tree = false): Tile => ({
  ground,
  water: undefined,
  biome: Biome.Plains,
  tree,
});

const tilesOf =
  (tiles: Record<string, Tile>, rest = land(10)) =>
  (hex: Hex) =>
    tiles[hexKey(hex)] ?? rest;

const origin = { q: 0, r: 0 };
const ahead = { q: 4, r: 0 };

test("sees across flat ground up to its range", () => {
  const flat = tilesOf({});
  expect(canSee(flat, origin, { q: SIGHT, r: 0 })).toBe(true);
  expect(canSee(flat, origin, { q: SIGHT + 1, r: 0 })).toBe(false);
});

test("trees and hills between block sight", () => {
  expect(canSee(tilesOf({ "2,0": land(10, true) }), origin, ahead)).toBe(false);
  expect(canSee(tilesOf({ "2,0": land(12) }), origin, ahead)).toBe(false);
});

test("the target itself never blocks sight", () => {
  expect(canSee(tilesOf({ "4,0": land(10, true) }), origin, ahead)).toBe(true);
  expect(canSee(tilesOf({ "4,0": land(30) }), origin, ahead)).toBe(true);
});

test("high ground sees over trees below", () => {
  const tileAt = tilesOf({ "0,0": land(25), "2,0": land(10, true) });
  expect(canSee(tileAt, origin, ahead)).toBe(true);
});

test("visibleFrom lists every hex in sight", () => {
  const visible = visibleFrom(tilesOf({ "1,0": land(10, true) }), origin);
  expect(visible.has("1,0")).toBe(true);
  expect(visible.has("2,0")).toBe(false);
  expect(visible.has(hexKey({ q: 0, r: SIGHT }))).toBe(true);
});
