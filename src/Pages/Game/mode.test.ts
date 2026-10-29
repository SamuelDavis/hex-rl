import { describe, expect, test } from "vitest";
import { EXPLORE, transition, type Mode } from "./mode";
import { SPELLS } from "../../game/spells";
import { east, facingEast } from "../../game/testing";

const game = facingEast();
const range = SPELLS.fireball.aim.range;
const aiming: Mode = { kind: "aim", spell: "fireball", range, at: east };
const ahead = { q: 2, r: 0 };

describe("explore", () => {
  test("moves and waits as actions", () => {
    expect(transition(EXPLORE, { kind: "move", direction: "n" }, game)).toEqual(
      { mode: EXPLORE, action: { kind: "move", direction: "n" } },
    );
    expect(transition(EXPLORE, { kind: "wait" }, game)).toEqual({
      mode: EXPLORE,
      action: { kind: "wait" },
    });
  });

  test("confirm and cancel do nothing", () => {
    expect(transition(EXPLORE, { kind: "confirm" }, game)).toEqual({
      mode: EXPLORE,
    });
    expect(transition(EXPLORE, { kind: "cancel" }, game)).toEqual({
      mode: EXPLORE,
    });
  });

  test("unaimed and monster-aimed spells cast at once, at the target", () => {
    expect(transition(EXPLORE, { kind: "use", spell: "heal" }, game)).toEqual({
      mode: EXPLORE,
      action: { kind: "cast", spell: "heal", at: undefined },
    });
    expect(
      transition(EXPLORE, { kind: "use", spell: "strike" }, game, east),
    ).toEqual({
      mode: EXPLORE,
      action: { kind: "cast", spell: "strike", at: east },
    });
  });

  test("hex-aimed spells start aiming, on the target if in range", () => {
    expect(
      transition(EXPLORE, { kind: "use", spell: "fireball" }, game, ahead),
    ).toEqual({ mode: { ...aiming, at: ahead } });
  });

  test("hex-aimed spells that are unready cast at once, to be rejected", () => {
    const drained = { ...game, player: { ...game.player, mp: 0 } };
    expect(
      transition(EXPLORE, { kind: "use", spell: "fireball" }, drained),
    ).toEqual({
      mode: EXPLORE,
      action: { kind: "cast", spell: "fireball", at: undefined },
    });
  });
});

describe("aim", () => {
  test("moves steer the reticle within range, spending nothing", () => {
    expect(transition(aiming, { kind: "move", direction: "se" }, game)).toEqual(
      { mode: { ...aiming, at: ahead } },
    );
    const edge = { ...aiming, at: { q: range, r: 0 } };
    expect(transition(edge, { kind: "move", direction: "se" }, game)).toEqual({
      mode: edge,
    });
  });

  test("waiting does nothing", () => {
    expect(transition(aiming, { kind: "wait" }, game)).toEqual({
      mode: aiming,
    });
  });

  test("confirm, or the same slot again, casts at the reticle", () => {
    const cast = {
      mode: EXPLORE,
      action: { kind: "cast", spell: "fireball", at: east },
    };
    expect(transition(aiming, { kind: "confirm" }, game)).toEqual(cast);
    expect(
      transition(aiming, { kind: "use", spell: "fireball" }, game),
    ).toEqual(cast);
  });

  test("cancel returns to exploring without acting", () => {
    expect(transition(aiming, { kind: "cancel" }, game)).toEqual({
      mode: EXPLORE,
    });
  });

  test("another slot is chosen afresh", () => {
    expect(transition(aiming, { kind: "use", spell: "heal" }, game)).toEqual({
      mode: EXPLORE,
      action: { kind: "cast", spell: "heal", at: undefined },
    });
  });
});
