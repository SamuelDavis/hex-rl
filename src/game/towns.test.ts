import { describe, expect, test } from "vitest";
import {
  act,
  BOUNTY_GOLD_PER_LEVEL,
  newGame,
  type Game,
  type Intent,
  type Creature,
} from "./game";
import { hexKey, type Direction, type Hex } from "./hex";
import { CREATURE_SPELLS, type CreatureKind } from "./creatures";
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

const withGold = (game: Game, gold: number): Game => ({
  ...game,
  player: { ...game.player, gold },
});

describe("towns", () => {
  const town = { kind: "town", at: { q: 6, r: 0 } } as const;
  const history = historyOf(newGame(landOf({}, [town])), 200);
  const kindsAt = (game: Game) => game.creatures.map(({ kind }) => kind);

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
    const lordless = {
      ...full,
      creatures: full.creatures.filter(
        ({ kind }) => kind !== "bailiff" && kind !== "peasant",
      ),
    };
    const next = historyOf(lordless, 100).find(
      (game) => game.creatures.length > lordless.creatures.length,
    )!;
    expect(kindsAt(next)).toContain("bailiff");
    expect(kindsAt(next)).not.toContain("peasant");
  });

  test("can't be attacked by the player", () => {
    const beside = { kind: "town", at: east } as const;
    const game = gameWith([], landOf({}, [beside]));
    const next = act(game, step("se"));
    expect(next.turn).toBe(game.turn);
    expect(next.events).toMatchObject([{ kind: "rejected" }]);
  });
});

describe("factions", () => {
  test("townsfolk and monsters that notice each other fight", () => {
    const at = { q: 4, r: 0 };
    const goblin = creature(at, "goblin", "n");
    const peasant = townsfolk({ q: 4, r: -1 }, "peasant", "s");
    const next = act(gameWith([goblin, peasant]), WAIT);
    expect(next.events).toContainEqual({
      kind: "hitCreature",
      actor: "goblin",
      creature: "peasant",
    });
    expect(next.events).toContainEqual({
      kind: "hitCreature",
      actor: "peasant",
      creature: "goblin",
    });
  });

  test("townsfolk ignore the player", () => {
    const games = historyOf(gameWith([townsfolk(east, "bailiff")]), 5);
    for (const { events, player } of games.slice(1)) {
      expect(events.filter(({ kind }) => kind === "struck")).toEqual([]);
      expect(player.hp).toBeGreaterThan(0);
    }
  });

  test("kills by townsfolk earn the player nothing", () => {
    const at = { q: 4, r: 0 };
    const goblin = { ...creature(at, "goblin", "n"), hp: 1 };
    const bailiff = townsfolk({ q: 4, r: -1 }, "bailiff", "s");
    const next = act(gameWith([goblin, bailiff]), WAIT);
    expect(next.events).toContainEqual({
      kind: "killed",
      actor: "bailiff",
      creature: "goblin",
    });
    expect(next.player.xp).toBe(0);
    expect(next.kills).toBe(0);
  });

  test("the player's spells spare townsfolk", () => {
    const game = gameWith([townsfolk(east, "peasant")]);
    const next = act(game, { kind: "use", ability: "cleave" });
    expect(next.creatures[0]!.hp).toBe(game.creatures[0]!.hp);
  });
});

describe("interact", () => {
  test("bumping someone with a service interacts with them, spending a turn", () => {
    const game = gameWith([townsfolk(east, "reeve")]);
    const next = act(game, step("se"));
    expect(next.turn).toBe(game.turn + 1);
    expect(next.events).toContainEqual({
      kind: "interacted",
      creature: "reeve",
      id: hexKey(east),
    });
  });

  test("bumping someone without one is rejected, spending nothing", () => {
    const game = gameWith([townsfolk(east, "peasant")]);
    const next = act(game, step("se"));
    expect(next.turn).toBe(game.turn);
    expect(next.events).toEqual([
      {
        kind: "rejected",
        actor: "player",
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
    expect(act(game, { kind: "interact", at: far }).events).toMatchObject([
      { reason: "out-of-reach" },
    ]);
    const beside = gameWith([townsfolk({ q: 0, r: -1 }, "reeve")]);
    expect(
      act(beside, { kind: "interact", at: { q: 0, r: -1 } }).events[0],
    ).toMatchObject({ kind: "interacted" });
  });

  test("monsters can't be interacted with", () => {
    const game = gameWith([creature(east)]);
    expect(act(game, { kind: "interact", at: east }).events).toMatchObject([
      { reason: "uninterested" },
    ]);
  });

  test("idle townsfolk beside the player stand still", () => {
    const games = historyOf(gameWith([townsfolk(east, "peasant")]), 30);
    for (const { creatures } of games) expect(creatures[0]!.at).toEqual(east);
  });
});

describe("trade", () => {
  const ware = potion("ware");
  const sold = potion("sold");
  const reeve = {
    ...townsfolk(east, "reeve"),
    wares: [ware],
    readyAt: Infinity,
  };
  const trader = reeve.id;
  const shop = (gold: number) => {
    const game = withGold(gameWith([reeve]), gold);
    return { ...game, player: { ...game.player, pack: [sold] } };
  };
  const traderIn = (game: Game) => game.creatures[0]!;

  test("sells a pack item for its offer, spending a turn", () => {
    const game = shop(0);
    const next = act(game, { kind: "trade", trader, item: sold.id });
    expect(next.turn).toBe(game.turn + 1);
    expect(next.player.gold).toBe(offerOf(sold));
    expect(next.player.pack).toEqual([]);
    expect(traderIn(next).wares).toEqual([ware, sold]);
    expect(next.events).toContainEqual({
      kind: "sold",
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
    expect(next.player.gold).toBe(0);
    expect(next.player.pack).toEqual([sold, ware]);
    expect(traderIn(next).wares).toEqual([]);
  });

  test("rejects too little gold, a missing item and a distant trader, spending nothing", () => {
    const poor = shop(priceOf(ware) - 1);
    const reasonOf = (game: Game, item: string) =>
      act(game, { kind: "trade", trader, item }).events;
    expect(reasonOf(poor, ware.id)).toMatchObject([{ reason: "no-gold" }]);
    expect(reasonOf(poor, "nothing")).toMatchObject([{ reason: "no-item" }]);
    const away = {
      ...poor,
      creatures: [{ ...reeve, at: { q: 3, r: 0 } }],
    };
    expect(reasonOf(away, sold.id)).toMatchObject([{ reason: "out-of-reach" }]);
  });

  test("only reeves trade", () => {
    const game = { ...shop(0), creatures: [townsfolk(east, "peasant")] };
    expect(
      act(game, { kind: "trade", trader, item: sold.id }).events,
    ).toMatchObject([{ reason: "no-target" }]);
  });
});

describe("restock", () => {
  const spell = CREATURE_SPELLS.reeve;
  if (spell?.kind !== "restock") throw new Error("reeves restock");
  const far = { q: 5, r: 0 };

  test("an idle reeve fills its wares, then waits out a variable cooldown", () => {
    const games = historyOf(gameWith([townsfolk(far, "reeve")]), 3);
    const [, stocked] = games;
    const reeve = stocked!.creatures[0]!;
    expect(reeve.wares).toHaveLength(spell.stock);
    expect(stocked!.events).toContainEqual({
      kind: "restocked",
      creature: "reeve",
    });
    const [min, max] = spell.cooldown;
    expect(reeve.readyAt - stocked!.turn + 1).toBeGreaterThanOrEqual(min);
    expect(reeve.readyAt - stocked!.turn + 1).toBeLessThanOrEqual(max);
  });

  test("only tops up what was sold, and only once ready", () => {
    const part = {
      ...townsfolk(far, "reeve"),
      wares: [potion("left")],
      readyAt: 5,
    };
    const games = historyOf(gameWith([part]), 6);
    expect(games[4]!.creatures[0]!.wares).toHaveLength(1);
    const wares = games[5]!.creatures[0]!.wares;
    expect(wares).toHaveLength(spell.stock);
    expect(wares[0]).toEqual(potion("left"));
    expect(new Set(wares.map(({ id }) => id)).size).toBe(spell.stock);
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
    const fought = act({ ...game, creatures: [boss(east)] }, step("se"));
    return { ...fought, creatures: [bailiff] };
  };

  test("a bailiff posts the nearest lair, never a town", () => {
    expect(posted.player.bounty).toEqual({
      kind: "den",
      at: near.at,
      level: 1,
      isSlain: false,
    });
    expect(posted.events).toContainEqual({
      kind: "bountied",
      spawner: "den",
      at: near.at,
      level: 1,
    });
  });

  test("asking again before the boss is slain changes nothing", () => {
    expect(talk(posted).player).toEqual(posted.player);
  });

  test("only the player slaying that lair's boss fulfils it", () => {
    const other = {
      ...boss(east),
      home: { kind: "den", at: { q: 8, r: 0 } } as const,
    };
    const elsewhere = act({ ...posted, creatures: [other] }, step("se"));
    expect(elsewhere.player.bounty?.isSlain).toBe(false);
    const slain = slay(posted);
    expect(slain.player.bounty?.isSlain).toBe(true);
    expect(slain.events).toContainEqual({
      kind: "bountySlain",
      creature: "alpha wolf",
    });
  });

  test("returning pays by level and posts a lair of a higher level", () => {
    const paid = talk(slay(posted));
    expect(paid.events).toContainEqual({
      kind: "rewarded",
      gold: BOUNTY_GOLD_PER_LEVEL,
    });
    expect(paid.player.gold).toBe(
      slay(posted).player.gold + BOUNTY_GOLD_PER_LEVEL,
    );
    expect(paid.player.bountyLevel).toBe(1);
    expect(paid.player.bounty).toMatchObject({
      at: middle.at,
      level: dangerOf(middle.at, origin),
    });
    const bounty = { ...paid.player.bounty!, isSlain: true };
    const third = talk({ ...paid, player: { ...paid.player, bounty } });
    expect(third.player.bounty?.at).toEqual(remote.at);
  });

  test("any bailiff pays", () => {
    const slain = slay(posted);
    const stranger = {
      ...townsfolk(east, "bailiff"),
      id: "stranger",
      home: { kind: "town", at: { q: 0, r: 9 } } as const,
    };
    const paid = talk({ ...slain, creatures: [stranger] });
    expect(paid.player.bountyLevel).toBe(1);
  });
});

describe("minds", () => {
  test("monsters chase townsfolk as they chase the player", () => {
    const at = { q: 3, r: 0 };
    const peasant = townsfolk({ q: 3, r: -2 }, "peasant", "s");
    const goblin = creature(at, "goblin", "n");
    const next = act(gameWith([goblin, peasant]), WAIT);
    expect(next.creatures.find(({ kind }) => kind === "goblin")!.mind).toEqual(
      sighted(goblin.mind, at, peasant),
    );
  });
});
