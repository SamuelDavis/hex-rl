import { describe, expect, test } from "vitest";
import type { Game } from "../../game/game";
import { hexKey } from "../../game/hex";
import {
  nextTarget,
  sightOf,
  TARGET_MEMORY,
  tracked,
  type Target,
} from "./target";
import { gameWith, land, landOf, monster, origin } from "../../game/testing";

const RANGE = 5;
const near = monster({ q: 2, r: 0 }, "goblin", "se");
const far = monster({ q: 4, r: 0 });
const beyond = monster({ q: 6, r: 0 });

describe("nextTarget", () => {
  const game = gameWith([far, beyond, near]);

  test("cycles from none through monsters in view and range, nearest first, back to none", () => {
    const first = nextTarget(game, RANGE, undefined);
    expect(first).toEqual({ id: near.id, lastSeen: near.at, seenTurn: 0 });
    const second = nextTarget(game, RANGE, first);
    expect(second?.id).toBe(far.id);
    expect(nextTarget(game, RANGE, second)).toBeUndefined();
  });

  test("starts over when the target isn't in view", () => {
    const gone: Target = { id: "gone", lastSeen: origin, seenTurn: 0 };
    expect(nextTarget(game, RANGE, gone)?.id).toBe(near.id);
  });

  test("skips monsters the player can't see", () => {
    const world = landOf({ "2,0": land(10, true) });
    expect(nextTarget(gameWith([far], world), RANGE, undefined)).toBe(
      undefined,
    );
  });
});

describe("tracked", () => {
  const target = nextTarget(gameWith([far]), RANGE, undefined)!;
  const turnedAway = (turn: number): Game => {
    const game = gameWith([far]);
    return { ...game, turn, player: { ...game.player, facing: "nw" } };
  };

  test("follows a target in view", () => {
    const moved = { ...far, at: { q: 3, r: 0 } };
    expect(tracked({ ...gameWith([moved]), turn: 1 }, RANGE, target)).toEqual({
      id: far.id,
      lastSeen: moved.at,
      seenTurn: 1,
    });
  });

  test("remembers where a target out of view was last seen", () => {
    expect(tracked(turnedAway(1), RANGE, target)).toEqual(target);
  });

  test("forgets a target out of view for too long", () => {
    expect(tracked(turnedAway(TARGET_MEMORY - 1), RANGE, target)).toEqual(
      target,
    );
    expect(tracked(turnedAway(TARGET_MEMORY), RANGE, target)).toBeUndefined();
  });

  test("drops a target out of range", () => {
    const fled = { ...far, at: beyond.at };
    expect(tracked(gameWith([fled]), RANGE, target)).toBeUndefined();
  });

  test("drops a target that's gone", () => {
    expect(tracked(gameWith([]), RANGE, target)).toBeUndefined();
  });
});

describe("sightOf", () => {
  test("is what the monster sees from where it faces", () => {
    const sight = sightOf(gameWith([]), { ...far, facing: "se" });
    expect(sight.has(hexKey({ q: 8, r: 0 }))).toBe(true);
    expect(sight.has(hexKey(origin))).toBe(false);
  });
});
