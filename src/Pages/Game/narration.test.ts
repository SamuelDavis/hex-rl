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
      actor: ADVENTURER,
      action: { kind: "use", ability: "strike" },
      reason: "out-of-reach",
    }),
  ).toBe("The adventurer cannot cast strike: out of reach.");
  expect(
    narrationOf({
      kind: "rejected",
      actor: ADVENTURER,
      action: { kind: "move", direction: "n" },
      reason: "blocked",
    }),
  ).toBe("The adventurer cannot move: the way is blocked.");
});

test("events are told in the third person", () => {
  expect(narrationOf({ kind: "prepared", actor: ADVENTURER })).toBe(
    "The adventurer prepares themselves.",
  );
  expect(narrationOf({ kind: "hit", actor: troll, target: ADVENTURER })).toBe(
    "The troll hits the adventurer.",
  );
});

test("spawners are named for what they are", () => {
  expect(
    narrationOf({ kind: "wrecked", actor: ADVENTURER, spawner: "den" }),
  ).toMatch(/^The adventurer wrecks the /);
});

test("monsters are named by kind, and steps and turns by direction", () => {
  expect(narrationOf({ kind: "turned", actor: goblin, facing: "nw" })).toBe(
    "The goblin turns north-west.",
  );
  expect(
    narrationOf({
      kind: "stepped",
      actor: ADVENTURER,
      direction: "s",
      to: { q: 0, r: 1 },
    }),
  ).toBe("The adventurer steps south.");
  expect(
    narrationOf({
      kind: "rejected",
      actor: troll,
      action: { kind: "attack", at: { q: 0, r: 1 } },
      reason: "no-target",
    }),
  ).toBe("The troll cannot attack: no target.");
});

test("townsfolk are named for their town's biome", () => {
  expect(narrationOf({ kind: "restocked", actor: reeve })).toBe(
    "The coastal reeve restocks their wares.",
  );
  expect(
    narrationOf({ kind: "interacted", actor: ADVENTURER, target: reeve }),
  ).toBe("The adventurer hails the coastal reeve.");
});

test("summons and afflictions are counted", () => {
  expect(
    narrationOf({ kind: "summoned", actor: wolf, summoned: "cub", count: 2 }),
  ).toBe("The wolf summons 2 cubs.");
  expect(
    narrationOf({
      kind: "afflicted",
      actor: troll,
      target: ADVENTURER,
      affliction: "stun",
      turns: 1,
    }),
  ).toBe("The adventurer is stunned for 1 turn.");
});

describe("whoNameOf", () => {
  test("names the adventurer, townsfolk by biome, monsters by kind", () => {
    expect(whoNameOf(ADVENTURER)).toBe("adventurer");
    expect(whoNameOf(reeve)).toBe("coastal reeve");
    expect(whoNameOf(wolf)).toBe("wolf");
  });
});
