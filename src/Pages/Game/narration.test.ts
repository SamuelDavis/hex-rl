import { expect, test } from "vitest";
import { narrationOf } from "./narration";

test("rejections name the actor, the action and the reason", () => {
  expect(
    narrationOf({
      kind: "rejected",
      actor: "player",
      action: { kind: "use", ability: "strike" },
      reason: "out-of-reach",
    }),
  ).toBe("The adventurer cannot cast strike: out of reach.");
  expect(
    narrationOf({
      kind: "rejected",
      actor: "player",
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

test("monsters are named by kind, and steps and turns by direction", () => {
  expect(narrationOf({ kind: "turned", actor: "goblin", facing: "nw" })).toBe(
    "The goblin turns north-west.",
  );
  expect(
    narrationOf({
      kind: "stepped",
      actor: "player",
      direction: "s",
      to: { q: 0, r: 1 },
    }),
  ).toBe("The adventurer steps south.");
  expect(
    narrationOf({
      kind: "rejected",
      actor: "troll",
      action: { kind: "attack", at: { q: 0, r: 1 } },
      reason: "no-target",
    }),
  ).toBe("The troll cannot attack: no target.");
});
