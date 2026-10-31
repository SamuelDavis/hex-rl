import { describe, expect, test } from "vitest";
import {
  dueOf,
  gateOf,
  inflicted,
  NONE,
  permanent,
  recovered,
  remainingOf,
  shakeOffChanceOf,
} from "./conditions";
import { CONDITIONS } from "./content/conditions";
import { ADVENTURER } from "./testing";

describe("conditions", () => {
  const source = ADVENTURER;
  const paralyzed = inflicted(NONE, "paralysis", 10, 3, source);

  test("begin the next turn and last at most the turns inflicted", () => {
    expect(paralyzed.get("paralysis")).toEqual({
      since: 11,
      until: 14,
      source,
    });
    expect(remainingOf(paralyzed, "paralysis", 11)).toBe(3);
    expect(remainingOf(paralyzed, "paralysis", 13)).toBe(1);
    expect(remainingOf(paralyzed, "stun", 11)).toBe(0);
  });

  test("inflicting again extends to the later end, keeping when it began", () => {
    const again = inflicted(paralyzed, "paralysis", 11, 5, source);
    expect(again.get("paralysis")).toMatchObject({ since: 11, until: 17 });
    expect(inflicted(again, "paralysis", 12, 1, source)).toBe(again);
  });

  test("permanent ones last forever and are never extended or lost", () => {
    const vigorous = permanent(source, "vigor");
    expect(remainingOf(vigorous, "vigor", 1000)).toBe(Infinity);
    expect(inflicted(vigorous, "vigor", 5, 3, source)).toBe(vigorous);
    expect(recovered(vigorous, 1000, () => true).lost).toEqual([]);
  });

  test("gate Deeds by what they allow and forbid, only while current", () => {
    const stunned = inflicted(NONE, "stun", 10, 1, source);
    expect(gateOf(stunned, "step", 10)).toBeUndefined();
    expect(gateOf(stunned, "step", 11)).toBe("stun");
    expect(gateOf(stunned, "wait", 11)).toBeUndefined();
    expect(gateOf(paralyzed, "attack", 11)).toBeUndefined();
    expect(gateOf(paralyzed, "turn", 11)).toBe("paralysis");
    expect(gateOf(stunned, "step", 12)).toBeUndefined();
  });

  test("fall due every `interval`-th turn suffered", () => {
    const { interval } = CONDITIONS.vigor.every;
    const vigorous = permanent(source, "vigor");
    const due = Array.from({ length: 3 * interval }, (_, turn) => turn).filter(
      (turn) => dueOf(vigorous, turn).length > 0,
    );
    expect(due).toEqual([interval - 1, 2 * interval - 1, 3 * interval - 1]);
    const bleeding = inflicted(NONE, "bleed", 10, 2, source);
    expect(
      [10, 11, 12, 13].map((turn) => dueOf(bleeding, turn).length),
    ).toEqual([0, 1, 1, 0]);
  });

  test("are shaken off with a chance growing linearly each turn suffered", () => {
    const { shakeOff } = CONDITIONS.paralysis;
    const state = paralyzed.get("paralysis")!;
    expect(shakeOffChanceOf("paralysis", state, 10)).toBe(0);
    expect(shakeOffChanceOf("paralysis", state, 11)).toBe(0);
    expect(shakeOffChanceOf("paralysis", state, 12)).toBeCloseTo(shakeOff);
    expect(shakeOffChanceOf("paralysis", state, 1000)).toBe(1);
  });

  test("recover when worn off or shaken off", () => {
    const both = inflicted(paralyzed, "stun", 10, 1, source);
    const never = () => false;
    expect(recovered(both, 11, never)).toEqual({ kept: both, lost: [] });
    expect(recovered(both, 12, never)).toEqual({
      kept: paralyzed,
      lost: ["stun"],
    });
    const lucky = (id: string) => id === "paralysis";
    expect(recovered(paralyzed, 12, lucky)).toEqual({
      kept: NONE,
      lost: ["paralysis"],
    });
  });
});
