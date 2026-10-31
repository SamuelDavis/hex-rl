import { describe, expect, test } from "vitest";
import { messageOf, slotted, SLOT_COUNT, STARTING_LOADOUT } from "./loadout";

describe("STARTING_LOADOUT", () => {
  test("has every slot empty, as no spell is known yet", () => {
    expect(STARTING_LOADOUT).toEqual(
      Array.from({ length: SLOT_COUNT }, () => undefined),
    );
  });
});

describe("slotted", () => {
  test("puts an ability in one slot, or empties it", () => {
    const full = slotted(slotted(STARTING_LOADOUT, 1, "cleave"), 2, "heal");
    const bound = slotted(slotted(full, 0, "health"), 1, undefined);
    expect(bound.slice(0, 3)).toEqual(["health", undefined, "heal"]);
  });
});

describe("messageOf", () => {
  test("a slot uses its ability; an empty slot does nothing; other input passes through", () => {
    const loadout = slotted(STARTING_LOADOUT, 0, "cleave");
    expect(messageOf(loadout, { kind: "slot", slot: 0 })).toEqual({
      kind: "use",
      ability: "cleave",
    });
    expect(messageOf(loadout, { kind: "slot", slot: 1 })).toBeUndefined();
    expect(messageOf(loadout, { kind: "wait" })).toEqual({ kind: "wait" });
  });
});
