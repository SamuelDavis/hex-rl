import { describe, expect, test } from "vitest";
import { creatureNameOf, narrationOf } from "./narration";
import { creature } from "../../game/testing";
import { Biome } from "../../game/terrain";

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
  expect(narrationOf({ kind: "struck", creature: "troll" })).toBe(
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

test("summons and afflictions are counted", () => {
  expect(
    narrationOf({
      kind: "summoned",
      creature: "wolf",
      summoned: "cub",
      count: 2,
    }),
  ).toBe("The wolf summons 2 cubs.");
  expect(
    narrationOf({
      kind: "afflicted",
      creature: "troll",
      affliction: "stun",
      turns: 1,
    }),
  ).toBe("The adventurer is stunned for 1 turn.");
});

describe("creatureNameOf", () => {
  test("names townsfolk by their town's biome, monsters by kind", () => {
    const town = { kind: "town", at: { q: 0, r: 0 } } as const;
    expect(
      creatureNameOf(creature({ q: 1, r: 0 }, "reeve", "n", town), Biome.Beach),
    ).toBe("coastal reeve");
    expect(creatureNameOf(creature({ q: 1, r: 0 }, "wolf"), Biome.Beach)).toBe(
      "wolf",
    );
  });
});
