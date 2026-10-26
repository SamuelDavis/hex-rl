import { expect, test } from "vitest";
import { hexKey, type Hex } from "./hex";
import { AWARENESS, canSee, SIGHT, visibleFrom } from "./sight";
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

test("visibleFrom lists every hex in sight within the cone faced", () => {
  const visible = visibleFrom(tilesOf({ "1,0": land(10, true) }), origin, "s");
  expect(visible.has("1,0")).toBe(true);
  expect(visible.has("2,0")).toBe(false);
  expect(visible.has(hexKey({ q: 0, r: SIGHT }))).toBe(true);
});

test("the cone spans the directions flanking the one faced", () => {
  const visible = visibleFrom(tilesOf({}), origin, "n");
  expect(visible.has(hexKey({ q: SIGHT, r: -SIGHT }))).toBe(true);
  expect(visible.has(hexKey({ q: -SIGHT, r: 0 }))).toBe(true);
  expect(visible.has(hexKey({ q: SIGHT, r: 0 }))).toBe(false);
  expect(visible.has(hexKey({ q: 0, r: SIGHT }))).toBe(false);
});

test("awareness sees all around, but no farther", () => {
  const visible = visibleFrom(tilesOf({}), origin, "n");
  expect(visible.has(hexKey({ q: 0, r: AWARENESS }))).toBe(true);
  expect(visible.has(hexKey({ q: 0, r: AWARENESS + 1 }))).toBe(false);
});

test("awareness is still blocked by obstacles", () => {
  const visible = visibleFrom(tilesOf({ "0,1": land(10, true) }), origin, "n");
  expect(visible.has("0,2")).toBe(false);
});
