import { expect, test } from "vitest";
import { narrationOf } from "./narration";

test("rejections name the actor, the action and the reason", () => {
  expect(
    narrationOf({
      kind: "rejected",
      action: { kind: "cast", spell: "strike" },
      reason: "out-of-reach",
    }),
  ).toBe("The adventurer cannot cast strike: out of reach.");
  expect(
    narrationOf({
      kind: "rejected",
      action: { kind: "move", direction: "n" },
      reason: "blocked",
    }),
  ).toBe("The adventurer cannot move: the way is blocked.");
});

test("events are told in the third person", () => {
  expect(narrationOf({ kind: "prepared" })).toBe(
    "The adventurer prepares themselves.",
  );
  expect(narrationOf({ kind: "struck", monster: "troll" })).toBe(
    "The troll hits the adventurer.",
  );
});

test("spawners are named for what they are", () => {
  expect(narrationOf({ kind: "wrecked", spawner: "den" })).toMatch(
    /^The adventurer wrecks the /,
  );
});
