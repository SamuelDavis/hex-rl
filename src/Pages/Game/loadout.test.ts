import { describe, expect, test } from "vitest";
import {
  decodeLoadout,
  messageOf,
  slotted,
  SLOT_COUNT,
  STARTING_LOADOUT,
} from "./loadout";

describe("STARTING_LOADOUT", () => {
  test("fills every slot it can with a spell", () => {
    expect(STARTING_LOADOUT).toHaveLength(SLOT_COUNT);
    expect(STARTING_LOADOUT.slice(0, 4)).toEqual([
      "cleave",
      "fireball",
      "heal",
      "strike",
    ]);
  });
});

describe("slotted", () => {
  test("puts an ability in one slot, or empties it", () => {
    const bound = slotted(slotted(STARTING_LOADOUT, 0, "health"), 1, undefined);
    expect(bound.slice(0, 3)).toEqual(["health", undefined, "heal"]);
  });
});

describe("decodeLoadout", () => {
  test("round-trips through JSON", () => {
    const loadout = slotted(STARTING_LOADOUT, 5, "mana");
    expect(decodeLoadout(JSON.stringify(loadout))).toEqual(loadout);
  });

  test("drops unknown abilities and fits the slot count", () => {
    expect(decodeLoadout('["cleave","meteor"]')).toEqual([
      "cleave",
      ...Array.from({ length: SLOT_COUNT - 1 }, () => undefined),
    ]);
  });
});

describe("messageOf", () => {
  test("a slot uses its ability; an empty slot does nothing; other input passes through", () => {
    const loadout = slotted(STARTING_LOADOUT, 1, undefined);
    expect(messageOf(loadout, { kind: "slot", slot: 0 })).toEqual({
      kind: "use",
      ability: "cleave",
    });
    expect(messageOf(loadout, { kind: "slot", slot: 1 })).toBeUndefined();
    expect(messageOf(loadout, { kind: "wait" })).toEqual({ kind: "wait" });
  });
});
