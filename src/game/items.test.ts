import { describe, expect, test } from "vitest";
import {
  BASE_CAPACITY,
  capacityOf,
  loadOf,
  lootOf,
  nameOf,
  overflowOf,
  placeFor,
  type GearKind,
  type Item,
} from "./items";
import { rngOf } from "procgen";
import { MONSTERS } from "./monsters";
import { monster, origin } from "./testing";

const gear = (id: string, gear: GearKind): Item => ({
  id,
  kind: "gear",
  gear,
  name: { base: gear },
});

const goblins = Array.from({ length: 300 }, (_, i) => ({
  ...monster(origin),
  id: `goblin-${i}`,
}));

describe("nameOf", () => {
  test("joins an optional material prefix, the base, and an optional suffix", () => {
    const boots: Item = {
      id: "b",
      kind: "gear",
      gear: "boots",
      name: { prefix: "chain", base: "boots", suffix: "of the goblin" },
    };
    expect(nameOf(boots)).toBe("chain boots of the goblin");
    expect(nameOf(gear("h", "helm"))).toBe("helm");
  });

  test("names potions for what they restore", () => {
    expect(nameOf({ id: "p", kind: "potion", potion: "health" })).toBe(
      "health potion",
    );
  });
});

describe("lootOf", () => {
  const loot = goblins.map((goblin) => lootOf(0, goblin));

  test("is deterministic per seed and monster", () => {
    expect(goblins.map((goblin) => lootOf(0, goblin))).toEqual(loot);
  });

  test("is nothing at all for some monsters, never an empty chest", () => {
    expect(loot).toContain(undefined);
    for (const chest of loot.filter((chest) => chest !== undefined))
      expect(chest.gold > 0 || chest.items.length > 0).toBe(true);
  });

  test("rolls gold within the monster's range", () => {
    const { min, max } = MONSTERS.goblin.gold;
    const golds = loot.flatMap((chest) => (chest?.gold ? [chest.gold] : []));
    expect(golds.length).toBeGreaterThan(0);
    for (const gold of golds) {
      expect(gold).toBeGreaterThanOrEqual(min);
      expect(gold).toBeLessThanOrEqual(max);
    }
  });

  test("drops both potions and gear, gear named for its source", () => {
    const items = loot.flatMap((chest) => chest?.items ?? []);
    expect(items.some(({ kind }) => kind === "potion")).toBe(true);
    const worn = items.filter((item) => item.kind === "gear");
    expect(worn.length).toBeGreaterThan(0);
    for (const item of worn) expect(nameOf(item)).toMatch(/ of the goblin$/);
  });

  test("gives every item a unique id", () => {
    const ids = loot.flatMap((chest) => chest?.items ?? []).map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("capacity", () => {
  test("is the base plus what each equipped bag adds", () => {
    expect(capacityOf({})).toBe(BASE_CAPACITY);
    expect(
      capacityOf({
        "bag 1": gear("s", "small bag"),
        "bag 2": gear("l", "large bag"),
        helm: gear("h", "helm"),
      }),
    ).toBe(BASE_CAPACITY + 2 + 6);
  });

  test("load sums item sizes; potions and bags are weightless", () => {
    expect(
      loadOf([
        gear("c", "chest"),
        gear("p", "pants"),
        gear("h", "helm"),
        gear("b", "bag"),
        { id: "p", kind: "potion", potion: "mana" },
      ]),
    ).toBe(3 + 2 + 1);
  });
});

describe("overflowOf", () => {
  const pack = [
    gear("h", "helm"),
    gear("c", "chest"),
    gear("g", "gloves"),
    gear("p", "pants"),
    gear("b", "boots"),
  ];

  test("keeps a pack within capacity", () => {
    expect(overflowOf(pack, 8, rngOf(0))).toEqual({ kept: pack, spilled: [] });
  });

  test("spills the largest items first until within capacity", () => {
    const { kept, spilled } = overflowOf(pack, 3, rngOf(0));
    expect(spilled.map(({ id }) => id)).toEqual(["c", "p"]);
    expect(kept.map(({ id }) => id)).toEqual(["h", "g", "b"]);
  });

  test("breaks ties between same-size items at random, deterministically", () => {
    const spillOf = (seed: number) =>
      overflowOf(pack, 2, rngOf(seed)).spilled.map(({ id }) => id);
    const spills = Array.from({ length: 30 }, (_, seed) => spillOf(seed));
    for (const spill of spills) expect(spill.slice(0, 2)).toEqual(["c", "p"]);
    expect(new Set(spills.map((spill) => spill[2])).size).toBeGreaterThan(1);
    expect(spillOf(1)).toEqual(spillOf(1));
  });
});

describe("placeFor", () => {
  test("is the place an item is worn, none for potions", () => {
    expect(placeFor(gear("h", "helm"), {})).toBe("helm");
    expect(placeFor({ id: "p", kind: "potion", potion: "health" }, {})).toBe(
      undefined,
    );
  });

  test("prefers an empty place, else swaps the first that fits", () => {
    const bag = gear("b", "bag");
    expect(placeFor(bag, { "bag 1": gear("x", "bag") })).toBe("bag 2");
    const full = {
      "bag 1": gear("x", "bag"),
      "bag 2": gear("y", "bag"),
      "bag 3": gear("z", "bag"),
    };
    expect(placeFor(bag, full)).toBe("bag 1");
  });
});
