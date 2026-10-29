import { describe, expect, test } from "vitest";
import { aimed, startAim } from "./aim";
import { facingEast, origin } from "../../game/testing";

const RANGE = 2;
const game = facingEast();

describe("startAim", () => {
  test("starts on the target when it is in range", () => {
    const target = { q: 2, r: -1 };
    expect(startAim(game, RANGE, target)).toEqual(target);
  });

  test("starts ahead of the player without a target in range", () => {
    expect(startAim(game, RANGE, undefined)).toEqual({ q: 1, r: 0 });
    expect(startAim(game, RANGE, { q: 3, r: 0 })).toEqual({ q: 1, r: 0 });
  });
});

describe("aimed", () => {
  test("moves the aim one hex", () => {
    expect(aimed(game, RANGE, origin, "n")).toEqual({ q: 0, r: -1 });
  });

  test("stays within range of the player", () => {
    const edge = { q: RANGE, r: 0 };
    expect(aimed(game, RANGE, edge, "se")).toEqual(edge);
  });
});
