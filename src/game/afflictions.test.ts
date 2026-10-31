import { describe, expect, test } from "vitest";
import {
  AFFLICTIONS,
  inflicted,
  NONE,
  recovered,
  remainingOf,
  shakeOffChanceOf,
} from "./afflictions";

describe("afflictions", () => {
  const paralyzed = inflicted(NONE, "paralysis", 10, 3);

  test("last at most the turns inflicted", () => {
    expect(remainingOf(paralyzed, "paralysis", 10)).toBe(3);
    expect(remainingOf(paralyzed, "paralysis", 12)).toBe(1);
    expect(remainingOf(paralyzed, "stun", 10)).toBe(0);
  });

  test("inflicting again extends to the later end, keeping when it began", () => {
    const again = inflicted(paralyzed, "paralysis", 11, 5);
    expect(again.get("paralysis")).toEqual({ since: 10, until: 16 });
    expect(inflicted(again, "paralysis", 12, 1)).toEqual(again);
  });

  test("are shaken off with a chance growing linearly each turn suffered", () => {
    const { shakeOff } = AFFLICTIONS.paralysis;
    const status = paralyzed.get("paralysis")!;
    expect(shakeOffChanceOf("paralysis", status, 10)).toBe(0);
    expect(shakeOffChanceOf("paralysis", status, 11)).toBeCloseTo(shakeOff);
    expect(shakeOffChanceOf("paralysis", status, 12)).toBeCloseTo(2 * shakeOff);
    expect(shakeOffChanceOf("paralysis", status, 1000)).toBe(1);
  });

  test("recover when worn off or shaken off", () => {
    const both = inflicted(paralyzed, "stun", 10, 1);
    const never = () => false;
    expect(recovered(both, 10, never)).toEqual({ kept: both, lost: [] });
    expect(recovered(both, 11, never)).toEqual({
      kept: paralyzed,
      lost: ["stun"],
    });
    const lucky = (affliction: string) => affliction === "paralysis";
    expect(recovered(paralyzed, 11, lucky)).toEqual({
      kept: NONE,
      lost: ["paralysis"],
    });
  });
});
