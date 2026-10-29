import { describe, expect, test } from "vitest";
import {
  act,
  ACTIVE_RADIUS,
  GOLD,
  cooldownOf,
  FORGET_RADIUS,
  isOver,
  isWrecked,
  MAX_HP,
  MAX_MP,
  newGame,
  HUNT_RADIUS,
  SPAWNER_HEAL_INTERVAL,
  type Action,
  type Game,
  type GameEvent,
  type Rejection,
  type SpawnerState,
  type Where,
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
  ABILITIES,
  CLEAVE_SPLASH,
  FIREBALL_DAMAGE,
  FIREBALL_SPLASH,
  HEAL_HP,
  HEALTH_POTION_HP,
  PLAYER_DAMAGE,
} from "./abilities";
import type { Spawner } from "./terrain";
import { lootOf, type Chest, type GearKind, type Item } from "./items";
import { AWARENESS, SIGHT } from "./sight";
import {
  east,
  facingEast,
  gameWith,
  land,
  landOf,
  monster,
  origin,
  step,
  WAIT,
} from "./testing";

const rejection = (action: Action, reason: Rejection): GameEvent => ({
  kind: "rejected",
  actor: "player",
  action,
  reason,
});

const gearOf = (id: string, gear: GearKind): Item => ({
  id,
  kind: "gear",
  gear,
  name: { base: id },
});

const pit = landOf({ "0,0": land(0) });

const historyOf = (game: Game, turns = 300, action: Action = WAIT) =>
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
    const freed = act({ ...held.at(-1)!, monsters: [] }, WAIT);
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
    const games = historyOf(idle, hits, step("se"));
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
    const games = historyOf(idle, hits, step("se"));
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

describe("turn, step and attack", () => {
  test("turn faces a direction and spends a turn; facing it already is rejected", () => {
    const turned = act(facingEast(), { kind: "turn", direction: "n" });
    expect(turned.player.facing).toBe("n");
    expect(turned.turn).toBe(1);
    const again: Action = { kind: "turn", direction: "se" };
    expect(act(facingEast(), again).events).toEqual([
      rejection(again, "already-facing"),
    ]);
  });

  test("step moves the way faced, never turns, and never attacks", () => {
    const stepped = act(facingEast(), { kind: "step", direction: "se" });
    expect(stepped.player.at).toEqual(east);
    const sideways: Action = { kind: "step", direction: "n" };
    expect(act(facingEast(), sideways).events).toEqual([
      rejection(sideways, "not-facing"),
    ]);
    const into: Action = { kind: "step", direction: "se" };
    const blocked = act(gameWith([monster(east, "troll")]), into);
    expect(blocked.monsters[0]!.hp).toBe(MONSTERS.troll.hp);
    expect(blocked.events).toEqual([rejection(into, "occupied")]);
  });

  test("attack needs the target faced", () => {
    const behind: Action = { kind: "attack", at: { q: -1, r: 0 } };
    expect(act(gameWith([monster({ q: -1, r: 0 })]), behind).events).toEqual([
      rejection(behind, "not-facing"),
    ]);
  });
});

describe("act", () => {
  test("a step too high to climb spends no turn", () => {
    const game = facingEast(landOf({ "1,0": land(12) }));
    const next = act(game, step("se"));
    expect(next).toEqual({
      ...game,
      events: [rejection(step("se"), "blocked")],
    });
  });

  test("a step onto level ground moves and spends a turn", () => {
    const next = act(facingEast(), step("se"));
    expect(next.player.at).toEqual(east);
    expect(next.turn).toBe(1);
  });

  test("a direction not faced turns in place and spends a turn", () => {
    const game = { ...newGame(landOf()), monsters: [monster({ q: 4, r: 0 })] };
    const next = act(game, step("se"));
    expect(next.player).toMatchObject({ at: origin, facing: "se" });
    expect(next.turn).toBe(1);
    expect(next.monsters[0]!.at).toEqual({ q: 3, r: 0 });
    expect(next.seen.has(hexKey({ q: SIGHT, r: 0 }))).toBe(true);
  });

  test("turning toward a cliff is allowed", () => {
    const next = act(newGame(landOf({ "1,0": land(12) })), step("se"));
    expect(next.player.facing).toBe("se");
  });

  test("waiting keeps facing", () => {
    expect(act(facingEast(), WAIT).player.facing).toBe("se");
  });

  test("bumping a monster attacks it", () => {
    const next = act(gameWith([monster(east, "troll")]), step("se"));
    expect(next.player.at).toEqual(origin);
    expect(next.monsters[0]!.hp).toBe(MONSTERS.troll.hp - PLAYER_DAMAGE);
  });

  test("attacking an adjacent monster hits it and spends a turn", () => {
    const next = act(gameWith([monster(east, "troll")]), {
      kind: "attack",
      at: east,
    });
    expect(next.monsters[0]!.hp).toBe(MONSTERS.troll.hp - PLAYER_DAMAGE);
    expect(next.turn).toBe(1);
  });

  test("attacking where nothing stands, or out of reach, spends no turn", () => {
    const empty: Action = { kind: "attack", at: east };
    expect(act(facingEast(), empty).events).toEqual([
      rejection(empty, "no-target"),
    ]);
    const far: Action = { kind: "attack", at: { q: 2, r: 0 } };
    expect(act(gameWith([monster({ q: 2, r: 0 })]), far).events).toEqual([
      rejection(far, "out-of-reach"),
    ]);
  });

  test("killing a monster removes and counts it", () => {
    const next = act(gameWith([{ ...monster(east), hp: 1 }]), step("se"));
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
      act(gameWith([kobold]), step("se")).chests.get(hexKey(east)),
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
    expect(act(game, step("se")).chests.get(hexKey(east))).toEqual({
      gold: 1 + loot.gold,
      items: [potion, ...loot.items],
    });
  });

  test("stepping onto a chest leaves it be", () => {
    const chest = { gold: 5, items: [] };
    const game = { ...facingEast(), chests: new Map([[hexKey(east), chest]]) };
    const next = act(game, step("se"));
    expect(next.player.gold).toBe(0);
    expect(next.chests.get(hexKey(east))).toEqual(chest);
  });

  test("adjacent monsters attack after the player acts", () => {
    const next = act(gameWith([monster(east)]), WAIT);
    expect(next.player.hp).toBe(MAX_HP - MONSTERS.goblin.damage);
  });

  test("monsters can't strike up a cliff", () => {
    const world = landOf({ "1,0": land(4) });
    expect(act(gameWith([monster(east)], world), WAIT).player.hp).toBe(MAX_HP);
  });

  test("monsters in sight close in", () => {
    const next = act(gameWith([monster({ q: 4, r: 0 })]), WAIT);
    expect(next.monsters[0]!.at).toEqual({ q: 3, r: 0 });
  });

  test("monsters turn to face the way they head, then step, like the player", () => {
    const turned = act(
      gameWith([monster({ q: 4, r: 0 }, "goblin", "n")]),
      WAIT,
    );
    expect(turned.monsters[0]).toMatchObject({
      at: { q: 4, r: 0 },
      facing: "nw",
    });
    expect(turned.events).toContainEqual({
      kind: "turned",
      actor: "goblin",
      facing: "nw",
    });
    const stepped = act(turned, WAIT);
    expect(stepped.monsters[0]).toMatchObject({
      at: { q: 3, r: 0 },
      facing: "nw",
    });
    expect(stepped.events).toContainEqual({
      kind: "stepped",
      actor: "goblin",
      direction: "nw",
      to: { q: 3, r: 0 },
    });
  });

  test("an adjacent hostile monster facing away turns before it strikes", () => {
    const beside = monster(east, "troll", "se");
    const turned = act(gameWith([beside]), WAIT);
    expect(turned.player.hp).toBe(MAX_HP);
    expect(turned.monsters[0]!.facing).toBe("nw");
    const struck = act(turned, WAIT);
    expect(struck.player.hp).toBe(MAX_HP - MONSTERS.troll.damage);
  });

  test("monsters facing away don't notice the player beyond their awareness", () => {
    const next = act(gameWith([monster({ q: 4, r: 0 }, "goblin", "se")]), WAIT);
    expect(next.monsters[0]!.mind).toBe(IDLE);
  });

  test("monsters notice the player within their awareness, whatever their facing", () => {
    const next = act(gameWith([monster({ q: 2, r: 0 }, "goblin", "se")]), WAIT);
    expect(next.monsters[0]!.mind.state).toBe("hostile");
  });

  test("monsters that notice the player turn hostile, anchored where they stood idle", () => {
    const at = { q: 4, r: 0 };
    const next = act(gameWith([monster(at)]), WAIT);
    expect(next.monsters[0]!.mind).toMatchObject({
      state: "hostile",
      anchor: at,
      lastSeen: origin,
    });
  });

  test("monsters that strike are hostile", () => {
    const next = act(gameWith([monster(east, "goblin", "se")]), WAIT);
    expect(next.monsters[0]!.mind.state).toBe("hostile");
  });

  test("hostile monsters head for where they last saw the player", () => {
    const at = { q: 6, r: 0 };
    const lastSeen = { q: 6, r: -4 };
    const hostile = { ...monster(at), mind: hostileAt(at, lastSeen) };
    const next = historyOf(gameWith([hostile], pit), 2).at(-1)!.monsters[0]!;
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
    const next = act(gameWith([hunter]), WAIT).monsters[0]!;
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
    const next = act(gameWith([monster(east, "goblin", "se")]), WAIT);
    expect(next.monsters[0]!.facing).toBe("nw");
  });

  test("monsters out of sight don't notice the player", () => {
    const world = landOf({ "2,0": land(10, true) });
    const next = act(gameWith([monster({ q: 4, r: 0 })], world), WAIT);
    expect(next.monsters[0]!.mind).toBe(IDLE);
  });

  test("monsters beyond the forget radius are forgotten", () => {
    const far = monster({ q: FORGET_RADIUS + 2, r: 0 });
    expect(act(gameWith([far]), WAIT).monsters).toEqual([]);
  });

  test("the game ends when the player dies, and accepts no more actions", () => {
    const game = {
      ...gameWith([monster(east)]),
      player: { ...newGame(landOf()).player, hp: 1 },
    };
    const dead = act(game, WAIT);
    expect(isOver(dead)).toBe(true);
    expect(act(dead, step("se"))).toEqual({
      ...dead,
      events: [rejection(step("se"), "over")],
    });
  });
});

describe("use", () => {
  const ne = add(origin, DIRECTIONS.ne);
  const south = add(origin, DIRECTIONS.s);
  const trolls = (...at: Hex[]) => at.map((hex) => monster(hex, "troll", "nw"));
  const hpAt = (game: Game, hex: Hex) =>
    game.monsters.find(({ id }) => id === hexKey(hex))?.hp;
  const TROLL = MONSTERS.troll.hp;

  test("spends mana, a turn, and starts the cooldown", () => {
    const next = act(facingEast(), { kind: "use", ability: "heal" });
    expect(next.turn).toBe(1);
    expect(next.player.mp).toBe(MAX_MP - ABILITIES.heal.mp);
    expect(cooldownOf(next, "heal")).toBe(ABILITIES.heal.cooldown);
  });

  test("cooldowns count down each turn until ready", () => {
    const cast = act(facingEast(), {
      kind: "use",
      ability: "fireball",
      at: east,
    });
    const waits = historyOf(cast, ABILITIES.fireball.cooldown);
    expect(waits.map((game) => cooldownOf(game, "fireball"))).toEqual([
      5, 4, 3, 2, 1, 0,
    ]);
  });

  test("can't be cast while cooling down, spending no turn", () => {
    const cast = act(facingEast(), { kind: "use", ability: "heal" });
    const again = act(cast, { kind: "use", ability: "heal" });
    expect(again.turn).toBe(cast.turn);
    expect(again.player).toEqual(cast.player);
    expect(again.events).toEqual([
      rejection({ kind: "use", ability: "heal" }, "not-ready"),
    ]);
  });

  test("can't be cast without enough mana, spending no turn", () => {
    const game = facingEast();
    const drained = { ...game, player: { ...game.player, mp: 1 } };
    const next = act(drained, { kind: "use", ability: "heal" });
    expect(next.turn).toBe(0);
    expect(next.events).toEqual([
      rejection({ kind: "use", ability: "heal" }, "no-mana"),
    ]);
  });

  test("mana regenerates over time, up to the maximum", () => {
    const game = facingEast();
    const drained = { ...game, player: { ...game.player, mp: 0 } };
    const history = historyOf(drained, 100);
    expect(history.at(-1)!.player.mp).toBe(MAX_MP);
    expect(history[1]!.player.mp).toBeLessThan(MAX_MP);
  });

  test("cleave hits ahead fully and either side by half", () => {
    const next = act(gameWith(trolls(east, ne, south)), {
      kind: "use",
      ability: "cleave",
    });
    expect(hpAt(next, east)).toBe(TROLL - PLAYER_DAMAGE);
    expect(hpAt(next, ne)).toBe(TROLL - PLAYER_DAMAGE * CLEAVE_SPLASH);
    expect(hpAt(next, south)).toBe(TROLL - PLAYER_DAMAGE * CLEAVE_SPLASH);
  });

  test("fireball burns the aimed hex fully and its neighbors by a quarter", () => {
    const at = { q: 3, r: 0 };
    const beside = { q: 4, r: 0 };
    const next = act(gameWith(trolls(at, beside)), {
      kind: "use",
      ability: "fireball",
      at,
    });
    expect(hpAt(next, at)).toBe(TROLL - FIREBALL_DAMAGE);
    expect(hpAt(next, beside)).toBe(TROLL - FIREBALL_DAMAGE * FIREBALL_SPLASH);
    expect(next.player.hp).toBe(MAX_HP);
  });

  test("fireball can't reach beyond its range or out of sight", () => {
    const far = { q: ABILITIES.fireball.aim.range + 1, r: 0 };
    const behind = { q: -AWARENESS - 1, r: 0 };
    for (const at of [far, behind, undefined]) {
      const next = act(facingEast(), { kind: "use", ability: "fireball", at });
      expect(next.turn).toBe(0);
    }
  });

  test("heal restores hit points, up to the maximum", () => {
    const game = facingEast();
    const hurt = { ...game, player: { ...game.player, hp: 1 } };
    expect(act(hurt, { kind: "use", ability: "heal" }).player.hp).toBe(
      1 + HEAL_HP,
    );
    expect(act(game, { kind: "use", ability: "heal" }).player.hp).toBe(MAX_HP);
  });

  test("strike faces the adjacent target and attacks it in one turn", () => {
    const next = act(gameWith(trolls(south)), {
      kind: "use",
      ability: "strike",
      at: south,
    });
    expect(next.turn).toBe(1);
    expect(next.player).toMatchObject({ at: origin, facing: "s" });
    expect(hpAt(next, south)).toBe(TROLL - PLAYER_DAMAGE);
  });

  test("strike can't be cast without a target in reach", () => {
    const far = { q: 3, r: 0 };
    const none = act(gameWith([]), { kind: "use", ability: "strike" });
    expect(none.turn).toBe(0);
    expect(none.events).toEqual([
      rejection({ kind: "use", ability: "strike" }, "no-target"),
    ]);
    const distant = act(gameWith(trolls(far)), {
      kind: "use",
      ability: "strike",
      at: far,
    });
    expect(distant.turn).toBe(0);
    expect(distant.events).toEqual([
      rejection({ kind: "use", ability: "strike", at: far }, "out-of-reach"),
    ]);
  });
});

describe("transfer", () => {
  const helm = gearOf("helm", "helm");
  const coif = gearOf("coif", "helm");
  const shirt = gearOf("shirt", "chest");
  const pants = gearOf("pants", "pants");
  const boots = gearOf("boots", "boots");
  const large = gearOf("large", "large bag");
  const potion: Item = { id: "potion", kind: "potion", potion: "health" };
  const here = hexKey(origin);
  const withLoot = (
    chest: Partial<Chest> | undefined,
    player: Partial<Game["player"]> = {},
  ): Game => {
    const game = facingEast();
    return {
      ...game,
      player: { ...game.player, ...player },
      chests: chest
        ? new Map([[here, { gold: 0, items: [], ...chest }]])
        : new Map(),
    };
  };
  const move = (cargo: string, to: Where): Action => ({
    kind: "transfer",
    cargo,
    to,
  });

  test("takes an item from the chest underfoot, spending a turn", () => {
    const next = act(withLoot({ items: [helm, potion] }), move("helm", "pack"));
    expect(next.turn).toBe(1);
    expect(next.player.pack).toEqual([helm]);
    expect(next.chests.get(here)?.items).toEqual([potion]);
  });

  test("takes gold, and an emptied chest is gone", () => {
    const next = act(withLoot({ gold: 7 }), move(GOLD, "pack"));
    expect(next.player.gold).toBe(7);
    expect(next.chests.has(here)).toBe(false);
  });

  test("puts items and gold down into a chest underfoot", () => {
    const game = withLoot(undefined, { pack: [helm], gold: 3 });
    const next = act(act(game, move("helm", "ground")), move(GOLD, "ground"));
    expect(next.player.pack).toEqual([]);
    expect(next.player.gold).toBe(0);
    expect(next.chests.get(here)).toEqual({ gold: 3, items: [helm] });
  });

  test("equips gear from the pack or the chest, and takes it off", () => {
    const game = withLoot({ items: [boots] }, { pack: [helm] });
    const worn = act(act(game, move("helm", "helm")), move("boots", "boots"));
    expect(worn.player.equipment).toEqual({ helm, boots });
    expect(worn.player.pack).toEqual([]);
    expect(worn.chests.has(here)).toBe(false);
    const off = act(worn, move("helm", "pack"));
    expect(off.player.equipment).toEqual({ boots });
    expect(off.player.pack).toEqual([helm]);
  });

  test("equipping over worn gear swaps it to where the new gear came from", () => {
    const game = withLoot({ items: [coif] }, { equipment: { helm } });
    const next = act(game, move("coif", "helm"));
    expect(next.player.equipment).toEqual({ helm: coif });
    expect(next.chests.get(here)?.items).toEqual([helm]);
  });

  test("rejects what doesn't fit, what isn't there, and a full pack, spending no turn", () => {
    const full = withLoot(
      { items: [helm, potion] },
      {
        pack: [shirt, pants, gearOf("gloves", "gloves")],
        equipment: { boots },
      },
    );
    const attempts: readonly (readonly [Action, Rejection])[] = [
      [move("helm", "boots"), "misfit"],
      [move("potion", "helm"), "misfit"],
      [move(GOLD, "helm"), "misfit"],
      [move("nothing", "pack"), "no-item"],
      [move(GOLD, "pack"), "no-item"],
      [move("helm", "pack"), "full"],
      [move("boots", "pack"), "full"],
    ];
    for (const [action, reason] of attempts) {
      const next = act(full, action);
      expect(next.events).toEqual([rejection(action, reason)]);
      expect(next.turn).toBe(0);
    }
    expect(act(full, move("potion", "pack")).player.pack).toContain(potion);
  });

  test("bags add capacity; taking one off spills the largest items underfoot", () => {
    const game = withLoot(
      { items: [helm] },
      { pack: [shirt, pants, boots], equipment: { "bag 1": large } },
    );
    const packed = act(game, move("helm", "pack"));
    expect(packed.player.pack).toHaveLength(4);
    const next = act(packed, move("large", "pack"));
    expect(next.player.pack.map(({ id }) => id).sort()).toEqual(
      ["boots", "helm", "large", "pants"].sort(),
    );
    expect(next.chests.get(here)?.items).toEqual([shirt]);
    expect(next.events).toContainEqual({ kind: "spilled", items: [shirt] });
  });

  test("destroying a chest clears it and all it holds, spending a turn", () => {
    const next = act(withLoot({ gold: 9, items: [helm] }), { kind: "destroy" });
    expect(next.chests.has(here)).toBe(false);
    expect(next.turn).toBe(1);
    expect(act(facingEast(), { kind: "destroy" }).events).toEqual([
      rejection({ kind: "destroy" }, "no-chest"),
    ]);
  });
});

describe("use a potion", () => {
  const health: Item = { id: "h", kind: "potion", potion: "health" };
  const mana: Item = { id: "m", kind: "potion", potion: "mana" };
  const holding = (game: Game, player: Partial<Game["player"]>): Game => ({
    ...game,
    player: { ...game.player, ...player },
  });

  test("restores up to the maximum and uses up one potion, spending no turn", () => {
    const game = holding(gameWith([monster(east, "troll")]), {
      hp: 5,
      mp: 9,
      pack: [health, mana, { ...health, id: "h2" }],
    });
    const healed = act(game, { kind: "use", ability: "health" });
    expect(healed.player.hp).toBe(5 + HEALTH_POTION_HP);
    expect(healed.player.pack).toEqual([mana, { ...health, id: "h2" }]);
    expect(healed.turn).toBe(0);
    expect(healed.monsters).toEqual(game.monsters);
    expect(healed.events).toEqual([{ kind: "used", ability: "health" }]);
    expect(act(healed, { kind: "use", ability: "mana" }).player.mp).toBe(
      MAX_MP,
    );
  });

  test("potions can be drunk back to back", () => {
    const game = holding(facingEast(), {
      hp: 1,
      pack: [health, { ...health, id: "h2" }],
    });
    const twice = act(act(game, { kind: "use", ability: "health" }), {
      kind: "use",
      ability: "health",
    });
    expect(twice.player.pack).toEqual([]);
  });

  test("can't quaff a potion not in the pack", () => {
    const action: Action = { kind: "use", ability: "mana" };
    expect(act(facingEast(), action).events).toEqual([
      rejection(action, "no-item"),
    ]);
  });
});

describe("prepare", () => {
  test("spends a turn and does nothing else", () => {
    const game = facingEast();
    const prepared = act(game, { kind: "prepare" });
    expect(prepared.turn).toBe(game.turn + 1);
    expect(prepared.player).toEqual(game.player);
    expect(prepared.events).toEqual([{ kind: "prepared" }]);
  });
});
