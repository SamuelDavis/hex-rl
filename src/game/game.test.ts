import { describe, expect, test } from "vitest";
import {
  act,
  ACTIVE_RADIUS,
  cooldownOf,
  FORGET_RADIUS,
  isOver,
  isWrecked,
  MAX_HP,
  MAX_MP,
  newGame,
  PLAYER_DAMAGE,
  HUNT_RADIUS,
  SPAWNER_HEAL_INTERVAL,
  type Action,
  type Game,
  type GameEvent,
  type Rejection,
  type SpawnerState,
} from "./game";
import {
  HUNT_TURNS,
  IDLE,
  TRACK_TURNS,
  type Hostile,
  type Hunting,
} from "./mind";
import {
  add,
  centerOf,
  DIRECTIONS,
  hexDistance,
  hexKey,
  sameHex,
  type Hex,
} from "./hex";
import { MONSTERS, SPAWNERS, spawnerHpOf, type SpawnerKind } from "./monsters";
import {
  CLEAVE_SPLASH,
  FIREBALL_DAMAGE,
  FIREBALL_SPLASH,
  HEAL_HP,
  SPELLS,
} from "./spells";
import type { Spawner } from "./terrain";
import { lootOf, type Item } from "./items";
import { AWARENESS, SIGHT } from "./sight";
import {
  east,
  facingEast,
  gameWith,
  land,
  landOf,
  monster,
  origin,
} from "./testing";

const rejection = (action: Action, reason: Rejection): GameEvent => ({
  kind: "rejected",
  action,
  reason,
});

const pit = landOf({ "0,0": land(0) });

const historyOf = (game: Game, turns = 300, action: Action = "wait") =>
  Array.from({ length: turns }).reduce<Game[]>(
    (games) => [...games, act(games.at(-1)!, action)],
    [game],
  );

const hostileAt = (anchor: Hex, lastSeen: Hex): Hostile => ({
  state: "hostile",
  anchor,
  lastSeen,
  heading: "n",
  unseenFor: 0,
});

const huntingAt = (anchor: Hex, lastSeen: Hex): Hunting => ({
  state: "hunting",
  anchor,
  lastSeen,
  heading: "n",
  huntedFor: 0,
});

const withState = (
  game: Game,
  spawner: Spawner,
  state: Partial<SpawnerState>,
): Game => ({
  ...game,
  monsters: [],
  spawners: new Map([
    [
      hexKey(spawner.at),
      {
        readyAt: 0,
        hp: spawnerHpOf(spawner.kind),
        hurtAt: 0,
        isWrecked: false,
        isBossDue: false,
        ...state,
      },
    ],
  ]),
});

const spawnsOf = (games: readonly Game[]) =>
  games
    .slice(1)
    .flatMap((game, i) =>
      game.monsters
        .filter(({ id }) => !games[i]!.monsters.some((m) => m.id === id))
        .map((monster) => ({ monster, turn: game.turn })),
    );

describe("newGame", () => {
  test("starts at the spawn with full health", () => {
    const game = newGame(landOf());
    expect(game.player).toMatchObject({ at: origin, hp: MAX_HP });
    expect(game.seen.has(hexKey(origin))).toBe(true);
  });

  test("sees only what lies ahead beyond its awareness", () => {
    const game = newGame(landOf());
    expect(game.seen.has(hexKey({ q: 0, r: -SIGHT }))).toBe(true);
    expect(game.seen.has(hexKey({ q: 0, r: SIGHT }))).toBe(false);
  });
});

describe("spawners", () => {
  const den = { kind: "den", at: { q: 6, r: 0 } } as const;
  const { pool, cap, interval } = SPAWNERS.den;
  const out = { "0,0": land(30) };

  const history = historyOf(newGame(landOf(out, [den])));
  const spawns = spawnsOf(history);

  test("spawn monsters from their pool beside themselves", () => {
    expect(spawns.length).toBeGreaterThan(0);
    for (const { monster } of spawns) {
      expect(monster.home).toEqual(den);
      expect(pool.map(([kind]) => kind)).toContain(monster.kind);
      expect(hexDistance(monster.at, den.at)).toBe(1);
    }
  });

  test("block monsters", () => {
    const blocker = { kind: "camp", at: { q: 6, r: -1 } } as const;
    const at = { q: 6, r: 0 };
    const hostile = { ...monster(at), mind: hostileAt(at, blocker.at) };
    const world = landOf(out, [blocker]);
    for (const { monsters } of history)
      for (const { at } of monsters) expect(at).not.toEqual(den.at);
    for (const { monsters } of historyOf(gameWith([hostile], world), 20))
      for (const { at } of monsters) expect(at).not.toEqual(blocker.at);
  });

  test("spawn nothing while hemmed in", () => {
    const walled = Object.fromEntries(
      Object.values(DIRECTIONS).map((d) => [
        hexKey({ q: den.at.q + d.q, r: den.at.r + d.r }),
        land(30),
      ]),
    );
    const hemmed = newGame(landOf({ ...out, ...walled }, [den]));
    expect(spawnsOf(historyOf(hemmed))).toEqual([]);
  });

  test("hold back their boss until there is room for it", () => {
    const site = add(den.at, DIRECTIONS.n);
    const walled = Object.fromEntries(
      [den.at, site]
        .flatMap((hex) => Object.values(DIRECTIONS).map((d) => add(hex, d)))
        .filter((hex) => !sameHex(hex, site) && !sameHex(hex, den.at))
        .map((hex) => [hexKey(hex), land(30)]),
    );
    const wrecked = withState(
      gameWith([], landOf({ ...out, ...walled }, [den])),
      den,
      { hp: 0, isWrecked: true, isBossDue: true },
    );
    const trapped = {
      ...wrecked,
      monsters: [monster(site, "goblin", "nw", den)],
    };
    const bossOf = ({ monsters }: Game) =>
      monsters.find(({ kind }) => kind === SPAWNERS.den.boss);
    const held = historyOf(trapped, 10);
    expect(held.filter(bossOf)).toEqual([]);
    const freed = act({ ...held.at(-1)!, monsters: [] }, "wait");
    expect(bossOf(freed)?.at).toEqual(site);
  });

  test("fill up to their cap and no further", () => {
    const counts = history.map(({ monsters }) => monsters.length);
    expect(Math.max(...counts)).toBe(cap);
  });

  test("wait their interval between spawns", () => {
    const turns = spawns.map(({ turn }) => turn);
    turns.slice(1).forEach((turn, i) => {
      expect(turn - turns[i]!).toBeGreaterThanOrEqual(interval);
    });
  });

  test("replace slain monsters", () => {
    const full = history.at(-1)!;
    const cleared = { ...full, monsters: [] };
    expect(spawnsOf(historyOf(cleared)).length).toBeGreaterThan(0);
  });

  test("have more hit points than the monsters they spawn", () => {
    for (const kind of Object.keys(SPAWNERS) as SpawnerKind[])
      for (const [spawned] of SPAWNERS[kind].pool)
        expect(spawnerHpOf(kind)).toBeGreaterThan(MONSTERS[spawned].hp);
  });

  test("block the player, who wrecks them by striking off their hit points", () => {
    const adjacent = { kind: "den", at: east } as const;
    const idle = withState(gameWith([], landOf(out, [adjacent])), adjacent, {
      readyAt: Infinity,
    });
    const hits = Math.ceil(spawnerHpOf("den") / PLAYER_DAMAGE);
    const games = historyOf(idle, hits, "se");
    expect(games.at(-1)!.player.at).toEqual(origin);
    expect(isWrecked(games.at(-2)!, adjacent)).toBe(false);
    expect(isWrecked(games.at(-1)!, adjacent)).toBe(true);
  });

  test("unleash their hostile boss when wrecked", () => {
    const adjacent = { kind: "den", at: east } as const;
    const idle = withState(gameWith([], landOf(out, [adjacent])), adjacent, {
      readyAt: Infinity,
    });
    const hits = Math.ceil(spawnerHpOf("den") / PLAYER_DAMAGE);
    const games = historyOf(idle, hits, "se");
    expect(games.at(-2)!.monsters).toEqual([]);
    expect(games.at(-1)!.monsters).toMatchObject([
      { kind: SPAWNERS.den.boss, home: adjacent, mind: { state: "hostile" } },
    ]);
    expect(hexDistance(games.at(-1)!.monsters[0]!.at, adjacent.at)).toBe(1);
  });

  test("have bosses stronger and richer than the monsters they spawn", () => {
    for (const kind of Object.keys(SPAWNERS) as SpawnerKind[]) {
      const boss = MONSTERS[SPAWNERS[kind].boss];
      for (const [spawned] of SPAWNERS[kind].pool) {
        const { hp, damage, gold } = MONSTERS[spawned];
        expect(boss.hp).toBeGreaterThan(hp);
        expect(boss.damage).toBeGreaterThanOrEqual(damage);
        expect(boss.gold.min).toBeGreaterThan(gold.max);
      }
    }
  });

  test("heal once wrecked, then spawn at once and restart their timer", () => {
    const wrecked = withState(newGame(landOf(out, [den])), den, {
      hp: 0,
      isWrecked: true,
    });
    const healedAt = spawnerHpOf("den") * SPAWNER_HEAL_INTERVAL;
    const games = historyOf(wrecked);
    expect(isWrecked(games[healedAt - 1]!, den)).toBe(true);
    expect(isWrecked(games[healedAt]!, den)).toBe(false);
    const turns = spawnsOf(games).map(({ turn }) => turn);
    expect(turns[0]).toBe(healedAt);
    expect(turns[1]! - healedAt).toBeGreaterThanOrEqual(interval);
  });

  test("stay dormant beyond the active radius", () => {
    const far = { kind: "den", at: { q: ACTIVE_RADIUS + 1, r: 0 } } as const;
    expect(spawnsOf(historyOf(newGame(landOf(out, [far]))))).toEqual([]);
  });
});

describe("act", () => {
  test("a step too high to climb spends no turn", () => {
    const game = facingEast(landOf({ "1,0": land(12) }));
    const next = act(game, "se");
    expect(next).toEqual({ ...game, events: [rejection("se", "blocked")] });
  });

  test("a step onto level ground moves and spends a turn", () => {
    const next = act(facingEast(), "se");
    expect(next.player.at).toEqual(east);
    expect(next.turn).toBe(1);
  });

  test("a direction not faced turns in place and spends a turn", () => {
    const game = { ...newGame(landOf()), monsters: [monster({ q: 4, r: 0 })] };
    const next = act(game, "se");
    expect(next.player).toMatchObject({ at: origin, facing: "se" });
    expect(next.turn).toBe(1);
    expect(next.monsters[0]!.at).toEqual({ q: 3, r: 0 });
    expect(next.seen.has(hexKey({ q: SIGHT, r: 0 }))).toBe(true);
  });

  test("turning toward a cliff is allowed", () => {
    const next = act(newGame(landOf({ "1,0": land(12) })), "se");
    expect(next.player.facing).toBe("se");
  });

  test("waiting keeps facing", () => {
    expect(act(facingEast(), "wait").player.facing).toBe("se");
  });

  test("bumping a monster attacks it", () => {
    const next = act(gameWith([monster(east, "troll")]), "se");
    expect(next.player.at).toEqual(origin);
    expect(next.monsters[0]!.hp).toBe(MONSTERS.troll.hp - PLAYER_DAMAGE);
  });

  test("killing a monster removes and counts it", () => {
    const next = act(gameWith([{ ...monster(east), hp: 1 }]), "se");
    expect(next.monsters).toEqual([]);
    expect(next.kills).toBe(1);
  });

  test("slain monsters drop their loot, if any, in a chest where they fell", () => {
    const kobolds = Array.from({ length: 50 }, (_, i) => ({
      ...monster(east, "kobold"),
      id: `${i}`,
      hp: 1,
    }));
    const chests = kobolds.map((kobold) =>
      act(gameWith([kobold]), "se").chests.get(hexKey(east)),
    );
    expect(chests).toEqual(kobolds.map((kobold) => lootOf(0, kobold)));
    expect(chests).toContain(undefined);
  });

  test("loot falling where a chest lies joins it", () => {
    const troll = { ...monster(east, "troll"), hp: 1 };
    const loot = lootOf(0, troll)!;
    const potion: Item = { id: "p", kind: "potion", potion: "mana" };
    const game = {
      ...gameWith([troll]),
      chests: new Map([[hexKey(east), { gold: 1, items: [potion] }]]),
    };
    expect(act(game, "se").chests.get(hexKey(east))).toEqual({
      gold: 1 + loot.gold,
      items: [potion, ...loot.items],
    });
  });

  test("stepping onto a chest leaves it be", () => {
    const chest = { gold: 5, items: [] };
    const game = { ...facingEast(), chests: new Map([[hexKey(east), chest]]) };
    const next = act(game, "se");
    expect(next.player.gold).toBe(0);
    expect(next.chests.get(hexKey(east))).toEqual(chest);
  });

  test("adjacent monsters attack after the player acts", () => {
    const next = act(gameWith([monster(east)]), "wait");
    expect(next.player.hp).toBe(MAX_HP - MONSTERS.goblin.damage);
  });

  test("monsters can't strike up a cliff", () => {
    const world = landOf({ "1,0": land(4) });
    expect(act(gameWith([monster(east)], world), "wait").player.hp).toBe(
      MAX_HP,
    );
  });

  test("monsters in sight close in", () => {
    const next = act(gameWith([monster({ q: 4, r: 0 })]), "wait");
    expect(next.monsters[0]!.at).toEqual({ q: 3, r: 0 });
  });

  test("monsters face the way they step", () => {
    const next = act(
      gameWith([monster({ q: 4, r: 0 }, "goblin", "n")]),
      "wait",
    );
    expect(next.monsters[0]).toMatchObject({
      at: { q: 3, r: 0 },
      facing: "nw",
    });
  });

  test("monsters facing away don't notice the player beyond their awareness", () => {
    const next = act(
      gameWith([monster({ q: 4, r: 0 }, "goblin", "se")]),
      "wait",
    );
    expect(next.monsters[0]!.mind).toBe(IDLE);
  });

  test("monsters notice the player within their awareness, whatever their facing", () => {
    const next = act(
      gameWith([monster({ q: 2, r: 0 }, "goblin", "se")]),
      "wait",
    );
    expect(next.monsters[0]).toMatchObject({ at: east, facing: "nw" });
  });

  test("monsters that notice the player turn hostile, anchored where they stood idle", () => {
    const at = { q: 4, r: 0 };
    const next = act(gameWith([monster(at)]), "wait");
    expect(next.monsters[0]!.mind).toMatchObject({
      state: "hostile",
      anchor: at,
      lastSeen: origin,
    });
  });

  test("monsters that strike are hostile", () => {
    const next = act(gameWith([monster(east, "goblin", "se")]), "wait");
    expect(next.monsters[0]!.mind.state).toBe("hostile");
  });

  test("hostile monsters head for where they last saw the player", () => {
    const at = { q: 6, r: 0 };
    const lastSeen = { q: 6, r: -4 };
    const hostile = { ...monster(at), mind: hostileAt(at, lastSeen) };
    const next = act(gameWith([hostile], pit), "wait").monsters[0]!;
    expect(hexDistance(next.at, lastSeen)).toBe(3);
  });

  test("monsters that lose track of the player hunt around where they last saw it, then go idle and head home", () => {
    const home = { kind: "village", at: { q: 6, r: 0 } } as const;
    const lastSeen = { q: 6, r: -4 };
    const hostile = {
      ...monster(home.at, "goblin", "nw", home),
      mind: hostileAt(home.at, lastSeen),
    };
    const states = historyOf(gameWith([hostile], pit), 60).map(
      ({ monsters }) => monsters[0]!,
    );
    const start = states.findIndex(({ mind }) => mind.state === "hunting");
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThanOrEqual(TRACK_TURNS);
    const hunting = states.slice(start, start + HUNT_TURNS);
    for (const { mind, at } of hunting) {
      expect(mind.state).toBe("hunting");
      expect(hexDistance(at, lastSeen)).toBeLessThanOrEqual(HUNT_RADIUS);
    }
    expect(new Set(hunting.map(({ at }) => hexKey(at))).size).toBeGreaterThan(
      1,
    );
    expect(states[start + HUNT_TURNS]!.mind).toBe(IDLE);
    expect(hexDistance(states.at(-1)!.at, home.at)).toBeLessThanOrEqual(
      SPAWNERS.village.leash,
    );
  });

  test("hunting monsters drift the way the player was heading", () => {
    const spots = [
      { q: 8, r: 0 },
      { q: -8, r: 0 },
      { q: 0, r: 8 },
      { q: 0, r: -8 },
      { q: 8, r: -8 },
      { q: -8, r: 8 },
    ];
    const hunters = spots.map((at) => ({
      ...monster(at, "goblin", "nw", { kind: "village", at }),
      mind: huntingAt(at, at),
    }));
    const games = historyOf(gameWith(hunters, pit), HUNT_TURNS - 1);
    const north = centerOf(DIRECTIONS.n);
    const drift = games.slice(1).flatMap(({ monsters }) =>
      monsters.map(({ at }, i) => {
        const from = centerOf(spots[i]!);
        const to = centerOf(at);
        return (to.x - from.x) * north.x + (to.y - from.y) * north.y;
      }),
    );
    expect(drift.reduce((sum, d) => sum + d, 0) / drift.length).toBeGreaterThan(
      0,
    );
  });

  test("engaged monsters are leashed to their anchor, not their home", () => {
    const home = { kind: "village", at: { q: 10, r: 0 } } as const;
    const games = historyOf(
      gameWith([monster({ q: 4, r: 0 }, "goblin", "nw", home)]),
      10,
    );
    expect(games.at(-1)!.player.hp).toBeLessThan(MAX_HP);
  });

  test("engaged monsters can't be drawn past their anchor's leash", () => {
    const anchor = { q: 12, r: 0 };
    const home = { kind: "village", at: anchor } as const;
    const chaser = {
      ...monster({ q: 7, r: 0 }, "goblin", "nw", home),
      mind: hostileAt(anchor, origin),
    };
    const games = historyOf(gameWith([chaser]), 10);
    for (const { monsters } of games.slice(1)) {
      expect(monsters[0]!.mind.state).toBe("hostile");
      expect(hexDistance(monsters[0]!.at, anchor)).toBeLessThanOrEqual(
        SPAWNERS.village.leash,
      );
    }
    expect(games.at(-1)!.player.hp).toBe(MAX_HP);
  });

  test("engaged monsters keep their anchor when they find the player again", () => {
    const anchor = { q: 12, r: 0 };
    const hunter = {
      ...monster({ q: 4, r: 0 }),
      mind: huntingAt(anchor, { q: 4, r: -2 }),
    };
    const next = act(gameWith([hunter]), "wait").monsters[0]!;
    expect(next.mind).toMatchObject({ state: "hostile", anchor });
  });

  test("idle monsters roam within their spawner's leash, and return to it when drawn away", () => {
    const home = { kind: "village", at: { q: 8, r: 0 } } as const;
    const { leash } = SPAWNERS.village;
    const strays = [
      monster({ q: 9, r: 0 }, "goblin", "nw", home),
      monster({ q: 8, r: -12 }, "goblin", "nw", home),
    ];
    const games = historyOf(gameWith(strays, pit), 60);
    const [homebody, stray] = [0, 1].map((i) =>
      games.map(({ monsters }) => monsters[i]!),
    );
    expect(new Set(homebody!.map(({ at }) => hexKey(at))).size).toBeGreaterThan(
      1,
    );
    for (const { at } of homebody!)
      expect(hexDistance(at, home.at)).toBeLessThanOrEqual(leash);
    expect(hexDistance(stray!.at(-1)!.at, home.at)).toBeLessThanOrEqual(leash);
  });

  test("monsters turn to face the player they strike", () => {
    const next = act(gameWith([monster(east, "goblin", "se")]), "wait");
    expect(next.monsters[0]!.facing).toBe("nw");
  });

  test("monsters out of sight don't notice the player", () => {
    const world = landOf({ "2,0": land(10, true) });
    const next = act(gameWith([monster({ q: 4, r: 0 })], world), "wait");
    expect(next.monsters[0]!.mind).toBe(IDLE);
  });

  test("monsters beyond the forget radius are forgotten", () => {
    const far = monster({ q: FORGET_RADIUS + 2, r: 0 });
    expect(act(gameWith([far]), "wait").monsters).toEqual([]);
  });

  test("the game ends when the player dies, and accepts no more actions", () => {
    const game = {
      ...gameWith([monster(east)]),
      player: { ...newGame(landOf()).player, hp: 1 },
    };
    const dead = act(game, "wait");
    expect(isOver(dead)).toBe(true);
    expect(act(dead, "se")).toEqual({
      ...dead,
      events: [rejection("se", "over")],
    });
  });
});

describe("cast", () => {
  const ne = add(origin, DIRECTIONS.ne);
  const south = add(origin, DIRECTIONS.s);
  const trolls = (...at: Hex[]) => at.map((hex) => monster(hex, "troll", "nw"));
  const hpAt = (game: Game, hex: Hex) =>
    game.monsters.find(({ id }) => id === hexKey(hex))?.hp;
  const TROLL = MONSTERS.troll.hp;

  test("spends mana, a turn, and starts the cooldown", () => {
    const next = act(facingEast(), { spell: "heal" });
    expect(next.turn).toBe(1);
    expect(next.player.mp).toBe(MAX_MP - SPELLS.heal.mp);
    expect(cooldownOf(next, "heal")).toBe(SPELLS.heal.cooldown);
  });

  test("cooldowns count down each turn until ready", () => {
    const cast = act(facingEast(), { spell: "fireball", at: east });
    const waits = historyOf(cast, SPELLS.fireball.cooldown);
    expect(waits.map((game) => cooldownOf(game, "fireball"))).toEqual([
      5, 4, 3, 2, 1, 0,
    ]);
  });

  test("can't be cast while cooling down, spending no turn", () => {
    const cast = act(facingEast(), { spell: "heal" });
    const again = act(cast, { spell: "heal" });
    expect(again.turn).toBe(cast.turn);
    expect(again.player).toEqual(cast.player);
    expect(again.events).toEqual([rejection({ spell: "heal" }, "not-ready")]);
  });

  test("can't be cast without enough mana, spending no turn", () => {
    const game = facingEast();
    const drained = { ...game, player: { ...game.player, mp: 1 } };
    const next = act(drained, { spell: "heal" });
    expect(next.turn).toBe(0);
    expect(next.events).toEqual([rejection({ spell: "heal" }, "no-mana")]);
  });

  test("mana regenerates over time, up to the maximum", () => {
    const game = facingEast();
    const drained = { ...game, player: { ...game.player, mp: 0 } };
    const history = historyOf(drained, 100);
    expect(history.at(-1)!.player.mp).toBe(MAX_MP);
    expect(history[1]!.player.mp).toBeLessThan(MAX_MP);
  });

  test("cleave hits ahead fully and either side by half", () => {
    const next = act(gameWith(trolls(east, ne, south)), { spell: "cleave" });
    expect(hpAt(next, east)).toBe(TROLL - PLAYER_DAMAGE);
    expect(hpAt(next, ne)).toBe(TROLL - PLAYER_DAMAGE * CLEAVE_SPLASH);
    expect(hpAt(next, south)).toBe(TROLL - PLAYER_DAMAGE * CLEAVE_SPLASH);
  });

  test("fireball burns the aimed hex fully and its neighbors by a quarter", () => {
    const at = { q: 3, r: 0 };
    const beside = { q: 4, r: 0 };
    const next = act(gameWith(trolls(at, beside)), { spell: "fireball", at });
    expect(hpAt(next, at)).toBe(TROLL - FIREBALL_DAMAGE);
    expect(hpAt(next, beside)).toBe(TROLL - FIREBALL_DAMAGE * FIREBALL_SPLASH);
    expect(next.player.hp).toBe(MAX_HP);
  });

  test("fireball can't reach beyond its range or out of sight", () => {
    const far = { q: SPELLS.fireball.aim.range + 1, r: 0 };
    const behind = { q: -AWARENESS - 1, r: 0 };
    for (const at of [far, behind, undefined]) {
      const next = act(facingEast(), { spell: "fireball", at });
      expect(next.turn).toBe(0);
    }
  });

  test("heal restores hit points, up to the maximum", () => {
    const game = facingEast();
    const hurt = { ...game, player: { ...game.player, hp: 1 } };
    expect(act(hurt, { spell: "heal" }).player.hp).toBe(1 + HEAL_HP);
    expect(act(game, { spell: "heal" }).player.hp).toBe(MAX_HP);
  });

  test("strike faces the adjacent target and attacks it in one turn", () => {
    const next = act(gameWith(trolls(south)), { spell: "strike", at: south });
    expect(next.turn).toBe(1);
    expect(next.player).toMatchObject({ at: origin, facing: "s" });
    expect(hpAt(next, south)).toBe(TROLL - PLAYER_DAMAGE);
  });

  test("strike can't be cast without a target in reach", () => {
    const far = { q: 3, r: 0 };
    const none = act(gameWith([]), { spell: "strike" });
    expect(none.turn).toBe(0);
    expect(none.events).toEqual([rejection({ spell: "strike" }, "no-target")]);
    const distant = act(gameWith(trolls(far)), { spell: "strike", at: far });
    expect(distant.turn).toBe(0);
    expect(distant.events).toEqual([
      rejection({ spell: "strike", at: far }, "out-of-reach"),
    ]);
  });
});
