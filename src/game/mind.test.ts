import { describe, expect, test } from "vitest";
import {
  HUNT_TURNS,
  IDLE,
  sighted,
  tetherOf,
  TRACK_TURNS,
  unsighted,
  type Hostile,
  type Mind,
} from "./mind";
import type { Hex } from "./hex";

const at = { q: 0, r: 0 };
const anchor = { q: 5, r: 0 };
const lastSeen = { q: 3, r: 0 };
const quarry = { at: { q: 1, r: 1 }, facing: "n" } as const;

const hostile: Hostile = {
  state: "hostile",
  anchor,
  lastSeen,
  heading: "s",
  unseenFor: 0,
};

const unsightedFor = (mind: Mind, turns: number, from: Hex = at) =>
  Array.from({ length: turns }).reduce<Mind>(
    (next) => unsighted(next, from),
    mind,
  );

describe("sighted", () => {
  test("idle minds turn hostile, anchored where they stood", () => {
    expect(sighted(IDLE, at, quarry)).toEqual({
      state: "hostile",
      anchor: at,
      lastSeen: quarry.at,
      heading: quarry.facing,
      unseenFor: 0,
    });
  });

  test("engaged minds turn hostile, keeping their anchor", () => {
    const hunting = unsightedFor(hostile, TRACK_TURNS);
    expect(sighted(hunting, at, quarry)).toMatchObject({
      state: "hostile",
      anchor,
      unseenFor: 0,
    });
  });
});

describe("tetherOf", () => {
  test("idle minds are tethered home", () => {
    expect(tetherOf(IDLE, at)).toBe(at);
  });

  test("engaged minds are tethered to their anchor", () => {
    expect(tetherOf(hostile, at)).toBe(anchor);
  });
});

describe("unsighted", () => {
  test("idle minds stay idle", () => {
    expect(unsighted(IDLE, at)).toBe(IDLE);
  });

  test("hostile minds track the player for a while, then hunt", () => {
    expect(unsightedFor(hostile, TRACK_TURNS - 1)).toMatchObject({
      state: "hostile",
      unseenFor: TRACK_TURNS - 1,
    });
    expect(unsightedFor(hostile, TRACK_TURNS)).toEqual({
      state: "hunting",
      anchor,
      lastSeen,
      heading: "s",
      huntedFor: 0,
    });
  });

  test("hostile minds hunt once they reach where the player was last seen", () => {
    expect(unsighted(hostile, lastSeen)).toMatchObject({ state: "hunting" });
  });

  test("hunting minds give up and go idle", () => {
    const hunting = unsightedFor(hostile, TRACK_TURNS);
    expect(unsightedFor(hunting, HUNT_TURNS - 1)).toMatchObject({
      state: "hunting",
      huntedFor: HUNT_TURNS - 1,
    });
    expect(unsightedFor(hunting, HUNT_TURNS)).toBe(IDLE);
  });
});
