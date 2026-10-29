import { expect, test } from "vitest";
import { narrationOf } from "./narration";

test("rejections name the action and the reason", () => {
  expect(
    narrationOf({
      kind: "rejected",
      action: { spell: "strike" },
      reason: "out-of-reach",
    }),
  ).toBe("Cannot cast strike: out of reach.");
  expect(
    narrationOf({ kind: "rejected", action: "n", reason: "blocked" }),
  ).toBe("Cannot move: the way is blocked.");
});

test("spawners are named for what they are", () => {
  expect(narrationOf({ kind: "wrecked", spawner: "den" })).toMatch(
    /^You wreck/,
  );
});
