import { describe, expect, test } from "vitest";
import {
  begun,
  gateOf,
  inflicted,
  NONE,
  permanent,
  recovered,
  remainingOf,
  shakeOffChanceOf,
  type Suffered,
} from "./conditions";
import { CONDITIONS } from "./content/conditions";
import { ADVENTURER } from "./testing";

const source = ADVENTURER;
const never = () => false;

/** The bearer's turn, suffered then recovered from, never shaken off. */
const turnOf = (conditions: Suffered) =>
  recovered(begun(conditions).conditions, never).kept;

describe("conditions", () => {
  const paralyzed = inflicted(NONE, "paralysis", 3, source);

  test("are registered when inflicted, yet to be suffered, lasting the turns inflicted", () => {
    expect(paralyzed.get("paralysis")).toEqual({
      source,
      suffered: 0,
      remaining: 3,
    });
    expect(remainingOf(paralyzed, "paralysis")).toBe(3);
    expect(remainingOf(paralyzed, "stun")).toBe(0);
  });

  test("count down the bearer's own turns, lost after the last", () => {
    const once = turnOf(paralyzed);
    expect(remainingOf(once, "paralysis")).toBe(2);
    expect(turnOf(turnOf(once))).toEqual(NONE);
  });

  test("inflicting again extends to the longer duration", () => {
    const again = inflicted(paralyzed, "paralysis", 5, source);
    expect(remainingOf(again, "paralysis")).toBe(5);
    expect(inflicted(again, "paralysis", 1, source)).toBe(again);
  });

  test("inflicted during the bearer's turn, run down only from its next", () => {
    const stunned = inflicted(begun(NONE).conditions, "stun", 1, source);
    expect(recovered(stunned, never).kept).toBe(stunned);
  });

  test("permanent ones last forever and are never extended or lost", () => {
    const vigorous = permanent(source, "vigor");
    expect(remainingOf(vigorous, "vigor")).toBe(Infinity);
    expect(inflicted(vigorous, "vigor", 3, source)).toBe(vigorous);
    expect(recovered(begun(vigorous).conditions, () => true).lost).toEqual([]);
  });

  test("gate Deeds by what they allow and forbid", () => {
    const stunned = inflicted(NONE, "stun", 1, source);
    expect(gateOf(stunned, "step")).toBe("stun");
    expect(gateOf(stunned, "wait")).toBeUndefined();
    expect(gateOf(paralyzed, "attack")).toBeUndefined();
    expect(gateOf(paralyzed, "turn")).toBe("paralysis");
  });

  test("fall due at the start of every `interval`-th turn suffered", () => {
    const { interval } = CONDITIONS.vigor.every;
    const dueTurns = (conditions: Suffered, turns: number) =>
      Array.from({ length: turns }).reduce<{
        conditions: Suffered;
        due: number[];
      }>(
        ({ conditions, due }, _, turn) => {
          const next = begun(conditions);
          return {
            conditions: recovered(next.conditions, never).kept,
            due: next.due.length > 0 ? [...due, turn + 1] : due,
          };
        },
        { conditions, due: [] },
      ).due;
    expect(dueTurns(permanent(source, "vigor"), 3 * interval)).toEqual([
      interval,
      2 * interval,
      3 * interval,
    ]);
    expect(dueTurns(inflicted(NONE, "bleed", 2, source), 4)).toEqual([1, 2]);
  });

  test("are shaken off with a chance growing linearly each turn suffered", () => {
    const { shakeOff } = CONDITIONS.paralysis;
    const state = paralyzed.get("paralysis")!;
    expect(shakeOffChanceOf("paralysis", state)).toBe(0);
    expect(
      shakeOffChanceOf("paralysis", { ...state, suffered: 2 }),
    ).toBeCloseTo(2 * shakeOff);
    expect(shakeOffChanceOf("paralysis", { ...state, suffered: 100 })).toBe(1);
    const lucky = (id: string) => id === "paralysis";
    expect(recovered(begun(paralyzed).conditions, lucky)).toEqual({
      kept: NONE,
      lost: ["paralysis"],
    });
  });
});
