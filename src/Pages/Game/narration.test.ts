import { describe, expect, test } from "vitest";
import { narrationOf, whoNameOf } from "./narration";
import { ADVENTURER, creature, who } from "../../game/testing";
import { Biome } from "../../game/terrain";

const town = { kind: "town", at: { q: 0, r: 0 } } as const;
const troll = who(creature({ q: 0, r: 1 }, "troll"));
const goblin = who(creature({ q: 0, r: 1 }, "goblin"));
const wolf = who(creature({ q: 0, r: 1 }, "wolf"));
const reeve = who(creature({ q: 1, r: 0 }, "reeve", "n", town), Biome.Beach);

test("rejections name the actor, the action and the reason", () => {
  expect(
    narrationOf({
      kind: "rejected",
      source: ADVENTURER,
      action: { kind: "use", ability: "strike" },
      reason: "out-of-reach",
    }),
  ).toBe("The adventurer cannot cast strike: out of reach.");
  expect(
    narrationOf({
      kind: "rejected",
      source: ADVENTURER,
      action: { kind: "move", direction: "n" },
      reason: "blocked",
    }),
  ).toBe("The adventurer cannot move: the way is blocked.");
});

test("events are told in the third person", () => {
  expect(narrationOf({ kind: "prepared", source: ADVENTURER })).toBe(
    "The adventurer prepares themselves.",
  );
  expect(
    narrationOf({ kind: "hurt", source: troll, target: ADVENTURER, amount: 3 }),
  ).toBe("The troll hits the adventurer.");
  expect(
    narrationOf({
      kind: "hurt",
      source: troll,
      target: ADVENTURER,
      amount: 1,
      cause: { kind: "condition", condition: "bleed" },
    }),
  ).toBe("The adventurer bleeds.");
});

test("spawners are named for what they are", () => {
  const den = { id: "spawner:0,0", kind: "den", faction: "wild" } as const;
  expect(
    narrationOf({ kind: "wrecked", source: ADVENTURER, target: den }),
  ).toBe("The adventurer wrecks the wolf den.");
});

test("monsters are named by kind, and steps and turns by direction", () => {
  expect(narrationOf({ kind: "turned", source: goblin, facing: "nw" })).toBe(
    "The goblin turns north-west.",
  );
  expect(
    narrationOf({
      kind: "stepped",
      source: ADVENTURER,
      direction: "s",
      to: { q: 0, r: 1 },
    }),
  ).toBe("The adventurer steps south.");
  expect(
    narrationOf({
      kind: "rejected",
      source: troll,
      action: { kind: "attack", at: { q: 0, r: 1 } },
      reason: "no-target",
    }),
  ).toBe("The troll cannot attack: no target.");
});

test("townsfolk are named for their town's biome", () => {
  expect(narrationOf({ kind: "restocked", source: reeve })).toBe(
    "The coastal reeve restocks their wares.",
  );
  expect(
    narrationOf({ kind: "interacted", source: ADVENTURER, target: reeve }),
  ).toBe("The adventurer hails the coastal reeve.");
});

test("summons and conditions are counted", () => {
  expect(
    narrationOf({ kind: "summoned", source: wolf, summoned: "cub", count: 2 }),
  ).toBe("The wolf summons 2 cubs.");
  expect(
    narrationOf({
      kind: "conditioned",
      source: troll,
      target: ADVENTURER,
      condition: "stun",
      turns: 1,
    }),
  ).toBe("The adventurer is stunned for up to 1 turn.");
});

test("struggles and recoveries name the condition", () => {
  expect(
    narrationOf({
      kind: "struggled",
      source: ADVENTURER,
      condition: "paralysis",
    }),
  ).toBe("The adventurer struggles against paralysis.");
  expect(
    narrationOf({ kind: "recovered", source: ADVENTURER, condition: "stun" }),
  ).toBe("The adventurer shakes off the stun.");
});

describe("whoNameOf", () => {
  test("names the adventurer, townsfolk by biome, monsters by kind", () => {
    expect(whoNameOf(ADVENTURER)).toBe("adventurer");
    expect(whoNameOf(reeve)).toBe("coastal reeve");
    expect(whoNameOf(wolf)).toBe("wolf");
  });
});
