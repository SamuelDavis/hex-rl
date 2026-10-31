import { describe, expect, test } from "vitest";
import {
  act,
  BOUNTY_GOLD_PER_LEVEL,
  creaturesOf,
  newGame,
  playerOf,
  type Game,
  type Intent,
  type Creature,
} from "./game";
import { hexKey, type Direction, type Hex } from "./hex";
import { CREATURES, type CreatureKind } from "./content/creatures";
import { ABILITIES } from "./content/abilities";
import { offerOf, priceOf, type Item } from "./items";
import { dangerOf, type Spawner } from "./terrain";
import { sighted } from "./mind";
import {
  east,
  gameWith,
  land,
  landOf,
  creature,
  origin,
  step,
  WAIT,
  ADVENTURER,
  eventsOf,
  who,
  withCreatures,
  withPlayer,
} from "./testing";

const TOWN: Spawner = { kind: "town", at: { q: -3, r: 0 } };

const townsfolk = (at: Hex, kind: CreatureKind, facing: Direction = "nw") =>
  creature(at, kind, facing, TOWN);

const potion = (id: string): Item => ({ id, kind: "potion", potion: "health" });

const historyOf = (game: Game, turns: number, action: Intent = WAIT) =>
  Array.from({ length: turns }).reduce<Game[]>(
    (games) => [...games, act(games.at(-1)!, action)],
    [game],
  );

const withGold = (game: Game, gold: number): Game => withPlayer(game, { gold });

describe("towns", () => {
  const town = { kind: "town", at: { q: 6, r: 0 } } as const;
  const history = historyOf(newGame(landOf({}, [town])), 200);
  const kindsAt = (game: Game) => creaturesOf(game).map(({ kind }) => kind);

  test("spawn a bailiff, then a reeve, then peasants", () => {
    const firsts = history
      .map(kindsAt)
      .filter((kinds, i, all) => kinds.length > (all[i - 1]?.length ?? 0));
    expect(firsts.slice(0, 5)).toEqual([
      ["bailiff"],
      ["bailiff", "reeve"],
      ["bailiff", "reeve", "peasant"],
      ["bailiff", "reeve", "peasant", "peasant"],
      ["bailiff", "reeve", "peasant", "peasant", "peasant"],
    ]);
  });

  test("respawn a slain bailiff before anyone else", () => {
    const full = history.at(-1)!;
    const lordless = withCreatures(
      full,
      creaturesOf(full).filter(
        ({ kind }) => kind !== "bailiff" && kind !== "peasant",
      ),
    );
    const next = historyOf(lordless, 100).find(
      (game) => creaturesOf(game).length > creaturesOf(lordless).length,
    )!;
    expect(kindsAt(next)).toContain("bailiff");
    expect(kindsAt(next)).not.toContain("peasant");
  });

  test("can't be attacked by the player", () => {
    const beside = { kind: "town", at: east } as const;
    const game = gameWith([], landOf({}, [beside]));
    const next = act(game, step("se"));
    expect(next.turn).toBe(game.turn);
    expect(eventsOf(next)).toMatchObject([{ kind: "rejected" }]);
  });
});

describe("factions", () => {
  test("townsfolk and monsters that notice each other fight", () => {
    const at = { q: 4, r: 0 };
    const goblin = creature(at, "goblin", "n");
    const peasant = townsfolk({ q: 4, r: -1 }, "peasant", "s");
    const next = act(gameWith([goblin, peasant]), WAIT);
    expect(eventsOf(next)).toContainEqual({
      kind: "hurt",
      source: who(goblin),
      target: who(peasant),
      amount: CREATURES.goblin.damage,
    });
    expect(eventsOf(next)).toContainEqual({
      kind: "hurt",
      source: who(peasant),
      target: who(goblin),
      amount: CREATURES.peasant.damage,
    });
  });

  test("townsfolk ignore the player", () => {
    const games = historyOf(gameWith([townsfolk(east, "bailiff")]), 5);
    for (const game of games.slice(1)) {
      expect(game.events.filter(({ kind }) => kind === "hurt")).toEqual([]);
      expect(playerOf(game).hp).toBeGreaterThan(0);
    }
  });

  test("kills by townsfolk earn the player nothing", () => {
    const at = { q: 4, r: 0 };
    const goblin = { ...creature(at, "goblin", "n"), hp: 1 };
    const bailiff = townsfolk({ q: 4, r: -1 }, "bailiff", "s");
    const next = act(gameWith([goblin, bailiff]), WAIT);
    expect(eventsOf(next)).toContainEqual({
      kind: "killed",
      source: who(bailiff),
      target: who(goblin),
    });
    expect(playerOf(next).xp).toBe(0);
    expect(playerOf(next).kills).toBe(0);
  });

  test("a creature slain earlier in the turn takes no turn", () => {
    const at = { q: 4, r: 0 };
    const goblin = { ...creature(at, "goblin", "n"), hp: 1 };
    const bailiff = townsfolk({ q: 4, r: -1 }, "bailiff", "s");
    const next = act(gameWith([bailiff, goblin]), WAIT);
    expect(creaturesOf(next).map(({ kind }) => kind)).toEqual(["bailiff"]);
  });

  test("the player's spells spare townsfolk", () => {
    const game = gameWith([townsfolk(east, "peasant")]);
    const next = act(game, { kind: "use", ability: "cleave" });
    expect(creaturesOf(next)[0]!.hp).toBe(creaturesOf(game)[0]!.hp);
  });
});

describe("interact", () => {
  test("bumping someone with a service interacts with them, spending a turn", () => {
    const game = gameWith([townsfolk(east, "reeve")]);
    const next = act(game, step("se"));
    expect(next.turn).toBe(game.turn + 1);
    expect(eventsOf(next)).toContainEqual({
      kind: "interacted",
      source: ADVENTURER,
      target: who(creaturesOf(game)[0]!),
    });
  });

  test("bumping someone without one is rejected, spending nothing", () => {
    const game = gameWith([townsfolk(east, "peasant")]);
    const next = act(game, step("se"));
    expect(next.turn).toBe(game.turn);
    expect(eventsOf(next)).toEqual([
      {
        kind: "rejected",
        source: ADVENTURER,
        action: { kind: "interact", at: east },
        reason: "uninterested",
      },
    ]);
  });

  test("reaches only an adjacent creature, faced or not", () => {
    const far = { q: 2, r: 0 };
    const game = gameWith([
      townsfolk(far, "reeve"),
      townsfolk(origin, "reeve"),
    ]);
    expect(eventsOf(act(game, { kind: "interact", at: far }))).toMatchObject([
      { reason: "out-of-reach" },
    ]);
    const beside = gameWith([townsfolk({ q: 0, r: -1 }, "reeve")]);
    expect(
      eventsOf(act(beside, { kind: "interact", at: { q: 0, r: -1 } }))[0],
    ).toMatchObject({ kind: "interacted" });
  });

  test("without a target, interacting is rejected", () => {
    expect(eventsOf(act(gameWith([]), { kind: "interact" }))).toMatchObject([
      { reason: "no-target" },
    ]);
  });

  test("monsters can't be interacted with", () => {
    const game = gameWith([creature(east)]);
    expect(eventsOf(act(game, { kind: "interact", at: east }))).toMatchObject([
      { reason: "uninterested" },
    ]);
  });

  test("idle townsfolk beside the player stand still", () => {
    const games = historyOf(gameWith([townsfolk(east, "peasant")]), 30);
    for (const game of games) expect(creaturesOf(game)[0]!.at).toEqual(east);
  });
});

describe("trade", () => {
  const ware = potion("ware");
  const sold = potion("sold");
  const reeve = {
    ...townsfolk(east, "reeve"),
    wares: [ware],
    gold: offerOf(sold),
    readyAt: new Map([["restock", Infinity]] as const),
  };
  const trader = reeve.id;
  const shop = (gold: number) => {
    const game = withGold(gameWith([reeve]), gold);
    return withPlayer(game, { pack: [sold] });
  };
  const traderIn = (game: Game) => creaturesOf(game)[0]!;

  test("sells a pack item for its offer, spending a turn", () => {
    const game = shop(0);
    const next = act(game, { kind: "trade", trader, item: sold.id });
    expect(next.turn).toBe(game.turn + 1);
    expect(playerOf(next).gold).toBe(offerOf(sold));
    expect(playerOf(next).pack).toEqual([]);
    expect(traderIn(next).wares).toEqual([ware, sold]);
    expect(traderIn(next).gold).toBe(0);
    expect(eventsOf(next)).toContainEqual({
      kind: "sold",
      source: ADVENTURER,
      target: who(reeve),
      item: sold,
      price: offerOf(sold),
    });
  });

  test("buys a ware for its price", () => {
    const next = act(shop(priceOf(ware)), {
      kind: "trade",
      trader,
      item: ware.id,
    });
    expect(playerOf(next).gold).toBe(0);
    expect(playerOf(next).pack).toEqual([sold, ware]);
    expect(traderIn(next).wares).toEqual([]);
    expect(traderIn(next).gold).toBe(offerOf(sold) + priceOf(ware));
  });

  test("the reeve can't buy beyond its purse", () => {
    const broke = withCreatures(shop(0), [{ ...reeve, gold: 0 }]);
    const next = act(broke, { kind: "trade", trader, item: sold.id });
    expect(next.turn).toBe(broke.turn);
    expect(eventsOf(next)).toMatchObject([{ reason: "no-gold" }]);
  });

  test("rejects too little gold, a missing item and a distant trader, spending nothing", () => {
    const poor = shop(priceOf(ware) - 1);
    const reasonOf = (game: Game, item: string) =>
      act(game, { kind: "trade", trader, item }).events;
    expect(reasonOf(poor, ware.id)).toMatchObject([{ reason: "no-gold" }]);
    expect(reasonOf(poor, "nothing")).toMatchObject([{ reason: "no-item" }]);
    const away = withCreatures(poor, [{ ...reeve, at: { q: 3, r: 0 } }]);
    expect(reasonOf(away, sold.id)).toMatchObject([{ reason: "out-of-reach" }]);
  });

  test("only reeves trade", () => {
    const game = withCreatures(shop(0), [townsfolk(east, "peasant")]);
    expect(
      act(game, { kind: "trade", trader, item: sold.id }).events,
    ).toMatchObject([{ reason: "no-target" }]);
  });
});

describe("restock", () => {
  const [restock] = ABILITIES.restock.effects;
  if (restock?.kind !== "restock") throw new Error("reeves restock");
  const [min, max] = ABILITIES.restock.cooldown as readonly [number, number];
  const far = { q: 5, r: 0 };
  const restocking = (reeve: Creature) =>
    historyOf(gameWith([reeve]), 100).find(({ events }) =>
      events.some(({ kind }) => kind === "restocked"),
    )!;
  const reeveIn = (game: Game) => creaturesOf(game)[0]!;

  test("an idle reeve fills its wares, then waits out a variable cooldown", () => {
    const stocked = restocking(townsfolk(far, "reeve"));
    const reeve = reeveIn(stocked);
    expect(reeve.wares).toHaveLength(restock.stock);
    expect(reeve.gold).toBe(restock.gold);
    expect(eventsOf(stocked)).toContainEqual({
      kind: "restocked",
      source: who(reeve),
    });
    const cooldown = reeve.readyAt.get("restock")! - stocked.turn;
    expect(cooldown).toBeGreaterThanOrEqual(min);
    expect(cooldown).toBeLessThanOrEqual(max);
  });

  test("restocks a spent purse even with full wares", () => {
    const wares = Array.from({ length: restock.stock }, (_, i) =>
      potion(`${i}`),
    );
    const next = restocking({ ...townsfolk(far, "reeve"), wares });
    expect(reeveIn(next).gold).toBe(restock.gold);
    expect(reeveIn(next).wares).toEqual(wares);
  });

  test("only tops up what was sold, and only once ready", () => {
    const part = {
      ...townsfolk(far, "reeve"),
      wares: [potion("left")],
      readyAt: new Map([["restock", 5]] as const),
    };
    const stocked = restocking(part);
    expect(stocked.turn).toBeGreaterThan(5);
    const wares = reeveIn(stocked).wares!;
    expect(wares).toHaveLength(restock.stock);
    expect(wares[0]).toEqual(potion("left"));
    expect(new Set(wares.map(({ id }) => id)).size).toBe(restock.stock);
  });
});

describe("bounties", () => {
  const near: Spawner = { kind: "den", at: { q: 6, r: 0 } };
  const middle: Spawner = { kind: "camp", at: { q: 50, r: 0 } };
  const remote: Spawner = { kind: "mine", at: { q: 90, r: 0 } };
  const tiles = { [hexKey(near.at)]: land(30) };
  const world = landOf(tiles, [TOWN, remote, middle, near]);
  const bailiff = townsfolk(east, "bailiff");
  const talk = (game: Game) => act(game, step("se"));
  const posted = talk(gameWith([bailiff], world));
  const boss = (at: Hex): Creature => ({
    ...creature(at, "alpha wolf", "nw", near),
    hp: 1,
  });
  const slay = (game: Game) => {
    const fought = act(withCreatures(game, [boss(east)]), step("se"));
    return withCreatures(fought, [bailiff]);
  };

  test("a bailiff posts the nearest lair, never a town", () => {
    expect(playerOf(posted).bounty).toEqual({
      kind: "den",
      at: near.at,
      level: 1,
      isSlain: false,
    });
    expect(eventsOf(posted)).toContainEqual({
      kind: "bountied",
      source: who(bailiff),
      target: ADVENTURER,
      spawner: "den",
      at: near.at,
      level: 1,
    });
  });

  test("asking again before the boss is slain changes nothing", () => {
    expect(playerOf(talk(posted))).toEqual(playerOf(posted));
  });

  test("only the player slaying that lair's boss fulfils it", () => {
    const other = {
      ...boss(east),
      home: { kind: "den", at: { q: 8, r: 0 } } as const,
    };
    const elsewhere = act(withCreatures(posted, [other]), step("se"));
    expect(playerOf(elsewhere).bounty?.isSlain).toBe(false);
    const slain = slay(posted);
    expect(playerOf(slain).bounty?.isSlain).toBe(true);
    expect(eventsOf(slain)).toContainEqual({
      kind: "bountySlain",
      source: ADVENTURER,
      target: who(boss(east)),
    });
  });

  test("returning pays by level and posts a lair of a higher level", () => {
    const paid = talk(slay(posted));
    expect(eventsOf(paid)).toContainEqual({
      kind: "rewarded",
      source: who(bailiff),
      target: ADVENTURER,
      gold: BOUNTY_GOLD_PER_LEVEL,
    });
    expect(playerOf(paid).gold).toBe(
      playerOf(slay(posted)).gold + BOUNTY_GOLD_PER_LEVEL,
    );
    expect(playerOf(paid).bountyLevel).toBe(1);
    expect(playerOf(paid).bounty).toMatchObject({
      at: middle.at,
      level: dangerOf(middle.at, origin),
    });
    const bounty = { ...playerOf(paid).bounty!, isSlain: true };
    const third = talk(withPlayer(paid, { bounty }));
    expect(playerOf(third).bounty?.at).toEqual(remote.at);
  });

  test("any bailiff pays", () => {
    const slain = slay(posted);
    const stranger = {
      ...townsfolk(east, "bailiff"),
      id: "stranger",
      home: { kind: "town", at: { q: 0, r: 9 } } as const,
    };
    const paid = talk(withCreatures(slain, [stranger]));
    expect(playerOf(paid).bountyLevel).toBe(1);
  });
});

describe("minds", () => {
  test("monsters chase townsfolk as they chase the player", () => {
    const at = { q: 3, r: 0 };
    const peasant = townsfolk({ q: 3, r: -2 }, "peasant", "s");
    const goblin = creature(at, "goblin", "n");
    const next = act(gameWith([goblin, peasant]), WAIT);
    expect(
      creaturesOf(next).find(({ kind }) => kind === "goblin")!.mind,
    ).toEqual(sighted(goblin.mind, at, peasant));
  });
});
