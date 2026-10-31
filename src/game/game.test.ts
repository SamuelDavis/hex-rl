import { describe, expect, test } from "vitest";
import {
  act,
  cooldownOf,
  creaturesOf,
  GOLD,
  isOver,
  isWrecked,
  MAX_HP,
  MAX_MP,
  newGame,
  HUNT_RADIUS,
  levelOf,
  playerOf,
  spawnerIdOf,
  unlocksOf,
  XP_PER_LEVEL,
  type Intent,
  type Game,
  type GameEvent,
  type Rejection,
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
import {
  membersOf,
  CREATURES,
  SPAWNERS,
  spawnerHpOf,
  type SpawnerKind,
} from "./content/creatures";
import {
  ABILITIES,
  CLEAVE_SPLASH,
  FIREBALL_DAMAGE,
  FIREBALL_SPLASH,
  HEAL_HP,
  HEALTH_POTION_HP,
  PLAYER_DAMAGE,
} from "./content/abilities";
import { CONDITIONS } from "./content/conditions";
import { Biome, CHUNK, dangerOf, type Spawner } from "./terrain";
import { lootOf, type Chest, type GearKind, type Item } from "./items";
import { AWARENESS, SIGHT } from "./sight";
import type { Fields } from "./components";
import { SIMULATION_RADIUS } from "./systems/chunks";
import { updated } from "./world";
import {
  east,
  eventsOf,
  facingEast,
  gameWith,
  land,
  landOf,
  creature,
  origin,
  step,
  WAIT,
  ADVENTURER,
  who,
  withCreatures,
  withPlayer,
} from "./testing";

const rejection = (action: Intent, reason: Rejection): GameEvent => ({
  kind: "rejected",
  source: ADVENTURER,
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

const historyOf = (game: Game, turns = 300, action: Intent = WAIT) =>
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

/** `game` without creatures, `spawner`'s entity changed by `state`. */
const withState = (
  game: Game,
  spawner: Spawner,
  state: Partial<Fields>,
): Game => withCreatures(updated(game, spawnerIdOf(spawner.at), state), []);

const spawnsOf = (games: readonly Game[]) =>
  games.slice(1).flatMap((game, i) =>
    creaturesOf(game)
      .filter(({ id }) => !creaturesOf(games[i]!).some((m) => m.id === id))
      .map((creature) => ({ creature, turn: game.turn })),
  );

const MENDING = CONDITIONS.mending.every.interval;

describe("newGame", () => {
  test("starts at the spawn with full health", () => {
    const game = newGame(landOf());
    expect(playerOf(game)).toMatchObject({ at: origin, hp: MAX_HP });
    expect(game.seen.has(hexKey(origin))).toBe(true);
  });

  test("sees only what lies ahead beyond its awareness", () => {
    const game = newGame(landOf());
    expect(game.seen.has(hexKey({ q: 0, r: -SIGHT }))).toBe(true);
    expect(game.seen.has(hexKey({ q: 0, r: SIGHT }))).toBe(false);
  });
});

describe("spawners", () => {
  const mine = { kind: "mine", at: { q: 6, r: 0 } } as const;
  const { pool, cap, interval } = SPAWNERS.mine;
  const out = { "0,0": land(30) };

  const history = historyOf(newGame(landOf(out, [mine])));
  const spawns = spawnsOf(history);

  test("spawn monsters from their pool beside themselves", () => {
    expect(spawns.length).toBeGreaterThan(0);
    for (const { creature } of spawns) {
      expect(creature.home).toEqual(mine);
      expect(pool.map(([kind]) => kind)).toContain(creature.kind);
      expect(hexDistance(creature.at, mine.at)).toBe(1);
    }
  });

  test("block monsters", () => {
    const blocker = { kind: "camp", at: { q: 6, r: -1 } } as const;
    const at = { q: 6, r: 0 };
    const hostile = { ...creature(at), mind: hostileAt(at, blocker.at) };
    const world = landOf(out, [blocker]);
    for (const game of history)
      for (const { at } of creaturesOf(game)) expect(at).not.toEqual(mine.at);
    for (const game of historyOf(gameWith([hostile], world), 20))
      for (const { at } of creaturesOf(game))
        expect(at).not.toEqual(blocker.at);
  });

  test("spawn nothing while hemmed in", () => {
    const walled = Object.fromEntries(
      Object.values(DIRECTIONS).map((d) => [
        hexKey({ q: mine.at.q + d.q, r: mine.at.r + d.r }),
        land(30),
      ]),
    );
    const hemmed = newGame(landOf({ ...out, ...walled }, [mine]));
    expect(spawnsOf(historyOf(hemmed))).toEqual([]);
  });

  test("hold back their boss until there is room for it", () => {
    const site = add(mine.at, DIRECTIONS.n);
    const walled = Object.fromEntries(
      [mine.at, site]
        .flatMap((hex) => Object.values(DIRECTIONS).map((d) => add(hex, d)))
        .filter((hex) => !sameHex(hex, site) && !sameHex(hex, mine.at))
        .map((hex) => [hexKey(hex), land(30)]),
    );
    const wrecked = withState(
      gameWith([], landOf({ ...out, ...walled }, [mine])),
      mine,
      { hp: 0, isWrecked: true, isBossDue: true },
    );
    const trapped = withCreatures(wrecked, [
      creature(site, "goblin", "nw", mine),
    ]);
    const bossOf = (game: Game) =>
      creaturesOf(game).find(({ kind }) => kind === SPAWNERS.mine.boss);
    const held = historyOf(trapped, 10);
    expect(held.filter(bossOf)).toEqual([]);
    const freed = act(withCreatures(held.at(-1)!, []), WAIT);
    expect(bossOf(freed)?.at).toEqual(site);
  });

  test("fill up to their cap and no further", () => {
    const counts = history.map((game) => creaturesOf(game).length);
    expect(Math.max(...counts)).toBe(cap);
  });

  test("wait their interval between spawns", () => {
    const turns = spawns.map(({ turn }) => turn);
    turns.slice(1).forEach((turn, i) => {
      expect(turn - turns[i]!).toBeGreaterThanOrEqual(interval);
    });
  });

  test("replace slain monsters", () => {
    const cleared = withCreatures(history.at(-1)!, []);
    expect(spawnsOf(historyOf(cleared)).length).toBeGreaterThan(0);
  });

  test("have more hit points than the monsters they spawn", () => {
    for (const kind of Object.keys(SPAWNERS) as SpawnerKind[])
      for (const spawned of membersOf(kind))
        expect(spawnerHpOf(kind)).toBeGreaterThan(CREATURES[spawned].hp);
  });

  const adjacent = { kind: "mine", at: east } as const;
  const bumping = () =>
    historyOf(
      withState(gameWith([], landOf(out, [adjacent])), adjacent, {
        spawnsAt: Infinity,
      }),
      2 * spawnerHpOf("mine"),
      step("se"),
    );
  const wreckedAt = (games: readonly Game[]) =>
    games.findIndex((game) => isWrecked(game, adjacent));

  test("block the player, who wrecks them by striking off their hit points", () => {
    const games = bumping();
    const at = wreckedAt(games);
    expect(at).toBeGreaterThanOrEqual(
      Math.ceil(spawnerHpOf("mine") / PLAYER_DAMAGE),
    );
    for (const game of games) expect(playerOf(game).at).toEqual(origin);
    expect(eventsOf(games[at]!)).toContainEqual({
      kind: "wrecked",
      source: ADVENTURER,
      target: {
        id: spawnerIdOf(east),
        kind: "mine",
        faction: "wild",
        biome: Biome.Plains,
      },
    });
  });

  test("unleash their hostile boss when wrecked", () => {
    const games = bumping();
    const at = wreckedAt(games);
    expect(creaturesOf(games[at - 1]!)).toEqual([]);
    expect(creaturesOf(games[at]!)).toMatchObject([
      { kind: SPAWNERS.mine.boss, home: adjacent, mind: { state: "hostile" } },
    ]);
    expect(hexDistance(creaturesOf(games[at]!)[0]!.at, adjacent.at)).toBe(1);
  });

  test("have bosses stronger and richer than the monsters they spawn", () => {
    for (const type of Object.values(SPAWNERS)) {
      if (type.faction !== "wild") continue;
      const boss = CREATURES[type.boss];
      for (const [spawned] of type.pool) {
        const { hp, damage, gold } = CREATURES[spawned];
        expect(boss.hp).toBeGreaterThan(hp);
        expect(boss.damage).toBeGreaterThanOrEqual(damage);
        expect(boss.gold.min).toBeGreaterThan(gold.max);
      }
    }
  });

  test("mend once wrecked, then spawn at once and restart their timer", () => {
    const wrecked = withState(newGame(landOf(out, [mine])), mine, {
      hp: 0,
      isWrecked: true,
    });
    const games = historyOf(wrecked);
    const healedAt = games.findIndex((game) => !isWrecked(game, mine));
    expect(healedAt).toBe(MENDING * spawnerHpOf("mine"));
    const turns = spawnsOf(games).map(({ turn }) => turn);
    expect(turns[0]).toBe(healedAt);
    expect(turns[1]! - healedAt).toBeGreaterThanOrEqual(interval);
  });

  test("stay dormant outside the active chunks", () => {
    const far = {
      kind: "mine",
      at: { q: 2 * CHUNK * (SIMULATION_RADIUS + 1), r: 0 },
    } as const;
    expect(spawnsOf(historyOf(newGame(landOf(out, [far]))))).toEqual([]);
  });

  test("are entities with health and conditions, like any other", () => {
    const game = newGame(landOf(out, [mine]));
    expect(game.entities.get(spawnerIdOf(mine.at))).toMatchObject({
      hp: spawnerHpOf("mine"),
      faction: "wild",
      conditions: new Map([["mending", expect.anything()]]),
    });
  });
});

describe("turn, step and attack", () => {
  test("turn faces a direction and spends a turn; facing it already is rejected", () => {
    const turned = act(facingEast(), { kind: "turn", direction: "n" });
    expect(playerOf(turned).facing).toBe("n");
    expect(turned.turn).toBe(1);
    const again: Intent = { kind: "turn", direction: "se" };
    expect(eventsOf(act(facingEast(), again))).toEqual([
      rejection(again, "already-facing"),
    ]);
  });

  test("step moves the way faced, never turns, and never attacks", () => {
    const stepped = act(facingEast(), { kind: "step", direction: "se" });
    expect(playerOf(stepped).at).toEqual(east);
    const sideways: Intent = { kind: "step", direction: "n" };
    expect(eventsOf(act(facingEast(), sideways))).toEqual([
      rejection(sideways, "not-facing"),
    ]);
    const into: Intent = { kind: "step", direction: "se" };
    const blocked = act(gameWith([creature(east, "troll")]), into);
    expect(creaturesOf(blocked)[0]!.hp).toBe(CREATURES.troll.hp);
    expect(eventsOf(blocked)).toEqual([rejection(into, "occupied")]);
  });

  test("attack needs the target faced", () => {
    const behind: Intent = { kind: "attack", at: { q: -1, r: 0 } };
    expect(
      eventsOf(act(gameWith([creature({ q: -1, r: 0 })]), behind)),
    ).toEqual([rejection(behind, "not-facing")]);
  });
});

describe("act", () => {
  test("a step too high to climb spends no turn", () => {
    const game = facingEast(landOf({ "1,0": land(12) }));
    const next = act(game, step("se"));
    expect({ ...next, events: [] }).toEqual({ ...game, events: [] });
    expect(eventsOf(next)).toEqual([
      rejection({ kind: "step", direction: "se" }, "blocked"),
    ]);
  });

  test("a step onto level ground moves and spends a turn", () => {
    const next = act(facingEast(), step("se"));
    expect(playerOf(next).at).toEqual(east);
    expect(next.turn).toBe(1);
  });

  test("a direction not faced turns in place and spends a turn", () => {
    const game = withCreatures(newGame(landOf()), [creature({ q: 4, r: 0 })]);
    const next = act(game, step("se"));
    expect(playerOf(next)).toMatchObject({ at: origin, facing: "se" });
    expect(next.turn).toBe(1);
    expect(creaturesOf(next)[0]!.at).toEqual({ q: 3, r: 0 });
    expect(next.seen.has(hexKey({ q: SIGHT, r: 0 }))).toBe(true);
  });

  test("turning toward a cliff is allowed", () => {
    const next = act(newGame(landOf({ "1,0": land(12) })), step("se"));
    expect(playerOf(next).facing).toBe("se");
  });

  test("waiting keeps facing", () => {
    expect(playerOf(act(facingEast(), WAIT)).facing).toBe("se");
  });

  test("bumping a monster attacks it", () => {
    const next = act(gameWith([creature(east, "troll")]), step("se"));
    expect(playerOf(next).at).toEqual(origin);
    expect(creaturesOf(next)[0]!.hp).toBe(CREATURES.troll.hp - PLAYER_DAMAGE);
  });

  test("attacking an adjacent monster hits it and spends a turn", () => {
    const next = act(gameWith([creature(east, "troll")]), {
      kind: "attack",
      at: east,
    });
    expect(creaturesOf(next)[0]!.hp).toBe(CREATURES.troll.hp - PLAYER_DAMAGE);
    expect(next.turn).toBe(1);
  });

  test("attacking where nothing stands, or out of reach, spends no turn", () => {
    const empty: Intent = { kind: "attack", at: east };
    expect(eventsOf(act(facingEast(), empty))).toEqual([
      rejection(empty, "no-target"),
    ]);
    const far: Intent = { kind: "attack", at: { q: 2, r: 0 } };
    expect(eventsOf(act(gameWith([creature({ q: 2, r: 0 })]), far))).toEqual([
      rejection(far, "out-of-reach"),
    ]);
  });

  test("killing a monster removes and counts it", () => {
    const next = act(gameWith([{ ...creature(east), hp: 1 }]), step("se"));
    expect(creaturesOf(next)).toEqual([]);
    expect(playerOf(next).kills).toBe(1);
  });

  test("slain monsters drop their loot, if any, in a chest where they fell", () => {
    const kobolds = Array.from({ length: 50 }, (_, i) => ({
      ...creature(east, "kobold"),
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
    const troll = { ...creature(east, "troll"), hp: 1 };
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
    expect(playerOf(next).gold).toBe(0);
    expect(next.chests.get(hexKey(east))).toEqual(chest);
  });

  test("adjacent monsters attack after the player acts", () => {
    const next = act(gameWith([creature(east)]), WAIT);
    expect(playerOf(next).hp).toBe(MAX_HP - CREATURES.goblin.damage);
  });

  test("monsters can't strike up a cliff", () => {
    const world = landOf({ "1,0": land(4) });
    expect(playerOf(act(gameWith([creature(east)], world), WAIT)).hp).toBe(
      MAX_HP,
    );
  });

  test("monsters in sight close in", () => {
    const next = act(gameWith([creature({ q: 4, r: 0 })]), WAIT);
    expect(creaturesOf(next)[0]!.at).toEqual({ q: 3, r: 0 });
  });

  test("monsters turn to face the way they head, then step, like the player", () => {
    const turned = act(
      gameWith([creature({ q: 4, r: 0 }, "goblin", "n")]),
      WAIT,
    );
    expect(creaturesOf(turned)[0]).toMatchObject({
      at: { q: 4, r: 0 },
      facing: "nw",
    });
    expect(eventsOf(turned)).toContainEqual({
      kind: "turned",
      source: who(creature({ q: 4, r: 0 }, "goblin")),
      facing: "nw",
    });
    const stepped = act(turned, WAIT);
    expect(creaturesOf(stepped)[0]).toMatchObject({
      at: { q: 3, r: 0 },
      facing: "nw",
    });
    expect(eventsOf(stepped)).toContainEqual({
      kind: "stepped",
      source: who(creature({ q: 4, r: 0 }, "goblin")),
      direction: "nw",
      to: { q: 3, r: 0 },
    });
  });

  test("an adjacent hostile monster facing away turns before it strikes", () => {
    const beside = creature(east, "troll", "se");
    const turned = act(gameWith([beside]), WAIT);
    expect(playerOf(turned).hp).toBe(MAX_HP);
    expect(creaturesOf(turned)[0]!.facing).toBe("nw");
    const struck = act(turned, WAIT);
    expect(playerOf(struck).hp).toBe(MAX_HP - CREATURES.troll.damage);
  });

  test("monsters facing away don't notice the player beyond their awareness", () => {
    const next = act(
      gameWith([creature({ q: 4, r: 0 }, "goblin", "se")]),
      WAIT,
    );
    expect(creaturesOf(next)[0]!.mind).toBe(IDLE);
  });

  test("monsters notice the player within their awareness, whatever their facing", () => {
    const next = act(
      gameWith([creature({ q: 2, r: 0 }, "goblin", "se")]),
      WAIT,
    );
    expect(creaturesOf(next)[0]!.mind.state).toBe("hostile");
  });

  test("monsters that notice the player turn hostile, anchored where they stood idle", () => {
    const at = { q: 4, r: 0 };
    const next = act(gameWith([creature(at)]), WAIT);
    expect(creaturesOf(next)[0]!.mind).toMatchObject({
      state: "hostile",
      anchor: at,
      lastSeen: origin,
    });
  });

  test("monsters that strike are hostile", () => {
    const next = act(gameWith([creature(east, "goblin", "se")]), WAIT);
    expect(creaturesOf(next)[0]!.mind.state).toBe("hostile");
  });

  test("hostile monsters head for where they last saw the player", () => {
    const at = { q: 6, r: 0 };
    const lastSeen = { q: 6, r: -4 };
    const hostile = { ...creature(at), mind: hostileAt(at, lastSeen) };
    const next = creaturesOf(
      historyOf(gameWith([hostile], pit), 2).at(-1)!,
    )[0]!;
    expect(hexDistance(next.at, lastSeen)).toBe(3);
  });

  test("monsters that lose track of the player hunt around where they last saw it, then go idle and head home", () => {
    const home = { kind: "village", at: { q: 6, r: 0 } } as const;
    const lastSeen = { q: 6, r: -4 };
    const hostile = {
      ...creature(home.at, "goblin", "nw", home),
      mind: hostileAt(home.at, lastSeen),
    };
    const states = historyOf(gameWith([hostile], pit), 60).map(
      (game) => creaturesOf(game)[0]!,
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
      ...creature(at, "goblin", "nw", { kind: "village", at }),
      mind: huntingAt(at, at),
    }));
    const games = historyOf(gameWith(hunters, pit), HUNT_TURNS - 1);
    const north = centerOf(DIRECTIONS.n);
    const drift = games.slice(1).flatMap((game) =>
      creaturesOf(game).map(({ at }, i) => {
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
      gameWith([creature({ q: 4, r: 0 }, "goblin", "nw", home)]),
      10,
    );
    expect(playerOf(games.at(-1)!).hp).toBeLessThan(MAX_HP);
  });

  test("engaged monsters can't be drawn past their anchor's leash", () => {
    const anchor = { q: 12, r: 0 };
    const home = { kind: "village", at: anchor } as const;
    const chaser = {
      ...creature({ q: 7, r: 0 }, "goblin", "nw", home),
      mind: hostileAt(anchor, origin),
    };
    const games = historyOf(gameWith([chaser]), 10);
    for (const game of games.slice(1)) {
      const [chasing] = creaturesOf(game);
      expect(chasing!.mind.state).toBe("hostile");
      expect(hexDistance(chasing!.at, anchor)).toBeLessThanOrEqual(
        SPAWNERS.village.leash,
      );
    }
    expect(playerOf(games.at(-1)!).hp).toBe(MAX_HP);
  });

  test("engaged monsters keep their anchor when they find the player again", () => {
    const anchor = { q: 12, r: 0 };
    const hunter = {
      ...creature({ q: 4, r: 0 }),
      mind: huntingAt(anchor, { q: 4, r: -2 }),
    };
    const next = creaturesOf(act(gameWith([hunter]), WAIT))[0]!;
    expect(next.mind).toMatchObject({ state: "hostile", anchor });
  });

  test("idle monsters roam within their spawner's leash, and return to it when drawn away", () => {
    const home = { kind: "village", at: { q: 8, r: 0 } } as const;
    const { leash } = SPAWNERS.village;
    const strays = [
      creature({ q: 9, r: 0 }, "goblin", "nw", home),
      creature({ q: 8, r: -12 }, "goblin", "nw", home),
    ];
    const games = historyOf(gameWith(strays, pit), 60);
    const [homebody, stray] = [0, 1].map((i) =>
      games.map((game) => creaturesOf(game)[i]!),
    );
    expect(new Set(homebody!.map(({ at }) => hexKey(at))).size).toBeGreaterThan(
      1,
    );
    for (const { at } of homebody!)
      expect(hexDistance(at, home.at)).toBeLessThanOrEqual(leash);
    expect(hexDistance(stray!.at(-1)!.at, home.at)).toBeLessThanOrEqual(leash);
  });

  test("monsters turn to face the player they strike", () => {
    const next = act(gameWith([creature(east, "goblin", "se")]), WAIT);
    expect(creaturesOf(next)[0]!.facing).toBe("nw");
  });

  test("monsters out of sight don't notice the player", () => {
    const world = landOf({ "2,0": land(10, true) });
    const next = act(gameWith([creature({ q: 4, r: 0 })], world), WAIT);
    expect(creaturesOf(next)[0]!.mind).toBe(IDLE);
  });

  test("monsters outside the active chunks persist, frozen", () => {
    const far = creature({ q: 2 * CHUNK * (SIMULATION_RADIUS + 1), r: 0 });
    const games = historyOf(gameWith([far]), 20);
    for (const game of games)
      expect(creaturesOf(game)).toEqual([{ ...far, seq: expect.any(Number) }]);
  });

  test("the game ends when the player dies, and accepts no more actions", () => {
    const game = withPlayer(gameWith([creature(east)]), { hp: 1, facing: "n" });
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
  const trolls = (...at: Hex[]) =>
    at.map((hex) => creature(hex, "troll", "nw"));
  const hpAt = (game: Game, hex: Hex) =>
    creaturesOf(game).find(({ id }) => id === hexKey(hex))?.hp;
  const TROLL = CREATURES.troll.hp;

  test("spends mana, a turn, and starts the cooldown", () => {
    const next = act(facingEast(), { kind: "use", ability: "heal" });
    expect(next.turn).toBe(1);
    expect(playerOf(next).mp).toBe(MAX_MP - ABILITIES.heal.mp);
    expect(cooldownOf(next, playerOf(next), "heal")).toBe(
      ABILITIES.heal.cooldown,
    );
  });

  test("cooldowns count down each turn until ready", () => {
    const cast = act(facingEast(), {
      kind: "use",
      ability: "fireball",
      at: east,
    });
    const waits = historyOf(cast, ABILITIES.fireball.cooldown);
    expect(
      waits.map((game) => cooldownOf(game, playerOf(game), "fireball")),
    ).toEqual([5, 4, 3, 2, 1, 0]);
  });

  test("can't be cast while cooling down, spending no turn", () => {
    const cast = act(facingEast(), { kind: "use", ability: "heal" });
    const again = act(cast, { kind: "use", ability: "heal" });
    expect(again.turn).toBe(cast.turn);
    expect(playerOf(again)).toEqual(playerOf(cast));
    expect(eventsOf(again)).toEqual([
      rejection({ kind: "use", ability: "heal" }, "not-ready"),
    ]);
  });

  test("can't be cast without enough mana, spending no turn", () => {
    const game = facingEast();
    const drained = withPlayer(game, { mp: 1 });
    const next = act(drained, { kind: "use", ability: "heal" });
    expect(next.turn).toBe(0);
    expect(eventsOf(next)).toEqual([
      rejection({ kind: "use", ability: "heal" }, "no-mana"),
    ]);
  });

  test("mana regenerates over time, up to the maximum", () => {
    const game = facingEast();
    const drained = withPlayer(game, { mp: 0 });
    const history = historyOf(drained, 100);
    expect(playerOf(history.at(-1)!).mp).toBe(MAX_MP);
    expect(playerOf(history[1]!).mp).toBeLessThan(MAX_MP);
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
    expect(playerOf(next).hp).toBe(MAX_HP);
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
    const hurt = withPlayer(game, { hp: 1 });
    expect(playerOf(act(hurt, { kind: "use", ability: "heal" })).hp).toBe(
      1 + HEAL_HP,
    );
    expect(playerOf(act(game, { kind: "use", ability: "heal" })).hp).toBe(
      MAX_HP,
    );
  });

  test("strike faces the adjacent target and attacks it in one turn", () => {
    const next = act(gameWith(trolls(south)), {
      kind: "use",
      ability: "strike",
      at: south,
    });
    expect(next.turn).toBe(1);
    expect(playerOf(next)).toMatchObject({ at: origin, facing: "s" });
    expect(hpAt(next, south)).toBe(TROLL - PLAYER_DAMAGE);
  });

  test("strike can't be cast without a target in reach", () => {
    const far = { q: 3, r: 0 };
    const none = act(gameWith([]), { kind: "use", ability: "strike" });
    expect(none.turn).toBe(0);
    expect(eventsOf(none)).toEqual([
      rejection({ kind: "use", ability: "strike" }, "no-target"),
    ]);
    const distant = act(gameWith(trolls(far)), {
      kind: "use",
      ability: "strike",
      at: far,
    });
    expect(distant.turn).toBe(0);
    expect(eventsOf(distant)).toEqual([
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
    player: Partial<Fields> = {},
  ): Game => ({
    ...withPlayer(facingEast(), player),
    chests: chest
      ? new Map([[here, { gold: 0, items: [], ...chest }]])
      : new Map(),
  });
  const move = (cargo: string, to: Where): Intent => ({
    kind: "transfer",
    cargo,
    to,
  });

  test("takes an item from the chest underfoot, spending a turn", () => {
    const next = act(withLoot({ items: [helm, potion] }), move("helm", "pack"));
    expect(next.turn).toBe(1);
    expect(playerOf(next).pack).toEqual([helm]);
    expect(next.chests.get(here)?.items).toEqual([potion]);
  });

  test("takes gold, and an emptied chest is gone", () => {
    const next = act(withLoot({ gold: 7 }), move(GOLD, "pack"));
    expect(playerOf(next).gold).toBe(7);
    expect(next.chests.has(here)).toBe(false);
  });

  test("puts items and gold down into a chest underfoot", () => {
    const game = withLoot(undefined, { pack: [helm], gold: 3 });
    const next = act(act(game, move("helm", "ground")), move(GOLD, "ground"));
    expect(playerOf(next).pack).toEqual([]);
    expect(playerOf(next).gold).toBe(0);
    expect(next.chests.get(here)).toEqual({ gold: 3, items: [helm] });
  });

  test("equips gear from the pack or the chest, and takes it off", () => {
    const game = withLoot({ items: [boots] }, { pack: [helm] });
    const worn = act(act(game, move("helm", "helm")), move("boots", "boots"));
    expect(playerOf(worn).equipment).toEqual({ helm, boots });
    expect(playerOf(worn).pack).toEqual([]);
    expect(worn.chests.has(here)).toBe(false);
    const off = act(worn, move("helm", "pack"));
    expect(playerOf(off).equipment).toEqual({ boots });
    expect(playerOf(off).pack).toEqual([helm]);
  });

  test("equipping over worn gear swaps it to where the new gear came from", () => {
    const game = withLoot({ items: [coif] }, { equipment: { helm } });
    const next = act(game, move("coif", "helm"));
    expect(playerOf(next).equipment).toEqual({ helm: coif });
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
    const attempts: readonly (readonly [Intent, Rejection])[] = [
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
      expect(eventsOf(next)).toEqual([rejection(action, reason)]);
      expect(next.turn).toBe(0);
    }
    expect(playerOf(act(full, move("potion", "pack"))).pack).toContain(potion);
  });

  test("bags add capacity; taking one off spills the largest items underfoot", () => {
    const game = withLoot(
      { items: [helm] },
      { pack: [shirt, pants, boots], equipment: { "bag 1": large } },
    );
    const packed = act(game, move("helm", "pack"));
    expect(playerOf(packed).pack).toHaveLength(4);
    const next = act(packed, move("large", "pack"));
    expect(
      playerOf(next)
        .pack.map(({ id }) => id)
        .sort(),
    ).toEqual(["boots", "helm", "large", "pants"].sort());
    expect(next.chests.get(here)?.items).toEqual([shirt]);
    expect(eventsOf(next)).toContainEqual({
      kind: "spilled",
      source: ADVENTURER,
      items: [shirt],
    });
  });

  test("taking all takes the gold and the smallest items that fit, spending a turn", () => {
    const game = withLoot(
      { gold: 4, items: [shirt, potion, pants, helm] },
      { pack: [boots, gearOf("gloves", "gloves")] },
    );
    const next = act(game, { kind: "take-all" });
    expect(next.turn).toBe(1);
    expect(playerOf(next).gold).toBe(4);
    expect(playerOf(next).pack.map(({ id }) => id)).toEqual([
      "boots",
      "gloves",
      "potion",
      "helm",
      "pants",
    ]);
    expect(next.chests.get(here)).toEqual({ gold: 0, items: [shirt] });
    expect(eventsOf(next)).toContainEqual({
      kind: "moved",
      source: ADVENTURER,
      cargo: { kind: "gold", amount: 4 },
      from: "ground",
      to: "pack",
    });
  });

  test("taking all rejects a missing chest and a full pack, spending no turn", () => {
    const takeAll: Intent = { kind: "take-all" };
    const full = withLoot({ items: [helm] }, { pack: [shirt, shirt] });
    for (const [game, reason] of [
      [facingEast(), "no-chest"],
      [full, "full"],
    ] as const) {
      const next = act(game, takeAll);
      expect(eventsOf(next)).toEqual([rejection(takeAll, reason)]);
      expect(next.turn).toBe(0);
    }
  });

  test("destroying a chest clears it and all it holds, spending a turn", () => {
    const next = act(withLoot({ gold: 9, items: [helm] }), { kind: "destroy" });
    expect(next.chests.has(here)).toBe(false);
    expect(next.turn).toBe(1);
    expect(eventsOf(act(facingEast(), { kind: "destroy" }))).toEqual([
      rejection({ kind: "destroy" }, "no-chest"),
    ]);
  });
});

describe("use a potion", () => {
  const health: Item = { id: "h", kind: "potion", potion: "health" };
  const mana: Item = { id: "m", kind: "potion", potion: "mana" };
  const holding = (game: Game, player: Partial<Fields>): Game =>
    withPlayer(game, player);

  test("restores up to the maximum and uses up one potion, spending no turn", () => {
    const game = holding(gameWith([creature(east, "troll")]), {
      hp: 5,
      mp: 9,
      pack: [health, mana, { ...health, id: "h2" }],
    });
    const healed = act(game, { kind: "use", ability: "health" });
    expect(playerOf(healed).hp).toBe(5 + HEALTH_POTION_HP);
    expect(playerOf(healed).pack).toEqual([mana, { ...health, id: "h2" }]);
    expect(healed.turn).toBe(0);
    expect(creaturesOf(healed)).toEqual(creaturesOf(game));
    expect(eventsOf(healed)).toEqual([
      { kind: "used", source: ADVENTURER, ability: "health" },
    ]);
    expect(playerOf(act(healed, { kind: "use", ability: "mana" })).mp).toBe(
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
    expect(playerOf(twice).pack).toEqual([]);
  });

  test("can't quaff a potion not in the pack", () => {
    const action: Intent = { kind: "use", ability: "mana" };
    expect(eventsOf(act(facingEast(), action))).toEqual([
      rejection(action, "no-item"),
    ]);
  });
});

describe("prepare", () => {
  test("spends a turn and does nothing else", () => {
    const game = facingEast();
    const prepared = act(game, { kind: "prepare" });
    expect(prepared.turn).toBe(game.turn + 1);
    expect(playerOf(prepared)).toEqual(playerOf(game));
    expect(eventsOf(prepared)).toEqual([
      { kind: "prepared", source: ADVENTURER },
    ]);
  });
});

describe("levels", () => {
  const withXp = (game: Game, xp: number): Game => withPlayer(game, { xp });
  const learning = (spell: "cleave" | "heal"): Intent => ({
    kind: "learn",
    spell,
  });

  test("the player starts at level 1 knowing no spells", () => {
    const player = playerOf(newGame(landOf()));
    expect(levelOf(player)).toBe(1);
    expect(player.abilities.size).toBe(0);
    expect(unlocksOf(player)).toBe(0);
    const heal: Intent = { kind: "use", ability: "heal" };
    expect(eventsOf(act(newGame(landOf()), heal))).toEqual([
      rejection(heal, "unlearned"),
    ]);
  });

  test("level rises linearly with experience", () => {
    expect(
      [0, XP_PER_LEVEL - 1, XP_PER_LEVEL, 3 * XP_PER_LEVEL].map((xp) =>
        levelOf({ xp }),
      ),
    ).toEqual([1, 1, 2, 4]);
  });

  test("kills grant experience scaled by the monster's level", () => {
    const weak = {
      ...creature(east, "cub", "nw", undefined, XP_PER_LEVEL),
      hp: 1,
    };
    const next = act(gameWith([weak]), step("se"));
    expect(playerOf(next).xp).toBe(CREATURES.cub.hp * XP_PER_LEVEL);
    expect(eventsOf(next)).toContainEqual({
      kind: "leveled",
      source: ADVENTURER,
      level: 2,
    });
  });

  test("each unspent level learns a spell, or raises one, without spending a turn", () => {
    const game = withXp(newGame(landOf()), 2 * XP_PER_LEVEL);
    const once = act(game, learning("cleave"));
    expect(once.turn).toBe(0);
    expect(eventsOf(once)).toEqual([
      { kind: "learned", source: ADVENTURER, spell: "cleave", level: 1 },
    ]);
    const twice = act(once, learning("cleave"));
    expect(playerOf(twice).abilities.get("cleave")).toBe(2);
    expect(unlocksOf(playerOf(twice))).toBe(0);
    expect(eventsOf(act(twice, learning("heal")))).toEqual([
      rejection(learning("heal"), "no-unlocks"),
    ]);
  });

  test("spell effects scale linearly with spell level", () => {
    const game = gameWith([creature(east, "troll", "nw")]);
    const adept = withPlayer(game, { abilities: new Map([["cleave", 3]]) });
    const next = act(adept, { kind: "use", ability: "cleave" });
    expect(creaturesOf(next)[0]!.hp).toBe(
      CREATURES.troll.hp - 3 * PLAYER_DAMAGE,
    );
  });

  test("the player knows no creature's knacks", () => {
    const summon: Intent = { kind: "use", ability: "summon cubs" };
    expect(eventsOf(act(facingEast(), summon))).toEqual([
      rejection(summon, "unlearned"),
    ]);
  });
});

describe("monster levels", () => {
  const mine = { kind: "mine", at: { q: 6, r: 0 } } as const;
  const out = { "0,0": land(30) };
  const spawnedLevels = (spawn: Hex) => {
    const world = landOf(out, [mine]);
    const game = { ...newGame(world), land: { ...world, spawn } };
    return spawnsOf(historyOf(game, 40)).map(({ creature }) => creature.power);
  };

  test("rise with the spawner's distance from the spawn", () => {
    const far = { q: -200, r: 0 };
    expect(new Set(spawnedLevels(origin))).toEqual(new Set([1]));
    expect(new Set(spawnedLevels(far))).toEqual(
      new Set([dangerOf(mine.at, far)]),
    );
    expect(dangerOf(mine.at, far)).toBeGreaterThan(1);
  });

  test("scale monster damage linearly", () => {
    const kobold = creature(east, "kobold", "nw", undefined, 3);
    expect(playerOf(act(gameWith([kobold]), WAIT)).hp).toBe(
      MAX_HP - 3 * CREATURES.kobold.damage,
    );
  });
});

describe("monster abilities", () => {
  const leveled = (kind: Parameters<typeof creature>[1], level: number) =>
    creature(east, kind, "nw", undefined, level);
  const alone = (game: Game): Game => withCreatures(game, []);
  const healed = (game: Game): Game => withPlayer(game, { hp: MAX_HP });
  /** Waits, healed each turn, through `turns` turns. */
  const enduring = (game: Game, turns: number, action: Intent = WAIT) =>
    Array.from({ length: turns }).reduce<Game[]>(
      (games) => [...games, act(healed(games.at(-1)!), action)],
      [game],
    );
  const happened = (kind: GameEvent["kind"]) => (game: Game) =>
    game.events.some((event) => event.kind === kind);
  const firstConditioned = (kind: Parameters<typeof creature>[1], level = 1) =>
    enduring(gameWith([leveled(kind, level)]), 200).find(
      happened("conditioned"),
    )!;

  test("conditions ride on only some landed hits, at their chance", () => {
    const games = enduring(gameWith([leveled("goblin", 1)]), 300);
    const hits = games.filter(happened("hurt")).length;
    const conditioned = games.filter(happened("conditioned")).length;
    expect(conditioned).toBeGreaterThan(0);
    expect(conditioned).toBeLessThan(hits / 3);
  });

  test("bandits inflict up to a turn of bleeding per level, each bleed credited to them", () => {
    const bandit = leveled("bandit", 2);
    const bleeding = firstConditioned("bandit", 2);
    expect(eventsOf(bleeding)).toContainEqual({
      kind: "conditioned",
      source: who(bandit),
      target: ADVENTURER,
      condition: "bleed",
      turns: 2,
    });
    const after = historyOf(alone(bleeding), 3);
    const bleeds = after.flatMap(({ events }) =>
      events.filter(
        (event) =>
          event.kind === "hurt" &&
          event.cause?.kind === "condition" &&
          event.cause.condition === "bleed",
      ),
    );
    expect(bleeds.length).toBeGreaterThanOrEqual(1);
    expect(bleeds.length).toBeLessThanOrEqual(2);
    for (const bleed of bleeds)
      expect(bleed).toMatchObject({ source: who(bandit) });
    expect(playerOf(after.at(-1)!).conditions.has("bleed")).toBe(false);
  });

  test("stun allows only waiting; anything else is a turn lost struggling", () => {
    const stunned = alone(firstConditioned("troll", 2));
    const struggling = act(stunned, step("n"));
    expect(struggling.turn).toBe(stunned.turn + 1);
    expect(playerOf(struggling).at).toEqual(playerOf(stunned).at);
    expect(eventsOf(struggling)).toContainEqual({
      kind: "struggled",
      source: ADVENTURER,
      condition: "stun",
    });
  });

  test("paralysis stops turning and stepping, as a turn lost struggling, but not attacking", () => {
    const paralyzed = firstConditioned("goblin", 3);
    const struggling = act(paralyzed, step("n"));
    expect(struggling.turn).toBe(paralyzed.turn + 1);
    expect(eventsOf(struggling)).toContainEqual({
      kind: "struggled",
      source: ADVENTURER,
      condition: "paralysis",
    });
    expect(eventsOf(act(paralyzed, step("se")))).toContainEqual({
      kind: "hurt",
      source: ADVENTURER,
      target: who(leveled("goblin", 3)),
      amount: PLAYER_DAMAGE,
    });
  });

  test("abilities wait out their cooldown before recurring", () => {
    const cooldown = ABILITIES.paralyze.cooldown as number;
    const turns = enduring(gameWith([leveled("goblin", 2)]), 300)
      .filter(happened("conditioned"))
      .map(({ turn }) => turn);
    expect(turns.length).toBeGreaterThan(1);
    turns.slice(1).forEach((turn, i) => {
      expect(turn - turns[i]!).toBeGreaterThan(cooldown);
    });
  });

  test("however strong the caster, a condition is shaken off before long", () => {
    const { shakeOff } = CONDITIONS.stun;
    const elder = { ...leveled("troll", 6), hp: 10_000 };
    const games = enduring(gameWith([elder]), 300, step("se"));
    const streaks = games
      .map(({ events }) => events.some(({ kind }) => kind === "struggled"))
      .reduce<number[]>(
        (runs, isStruggling) =>
          isStruggling
            ? [...runs.slice(0, -1), (runs.at(-1) ?? 0) + 1]
            : [...runs, 0],
        [0],
      );
    expect(Math.max(...streaks)).toBeGreaterThan(0);
    expect(Math.max(...streaks)).toBeLessThanOrEqual(Math.ceil(1 / shakeOff));
  });

  test("hostile wolves summon a cub per level beside themselves", () => {
    const at = { q: 3, r: 0 };
    const wolf = {
      ...creature(at, "wolf", "nw", undefined, 2),
      mind: hostileAt(at, origin),
    };
    const games = enduring(gameWith([wolf]), 50);
    const index = games.findIndex(happened("summoned"));
    const next = games[index]!;
    const cubs = creaturesOf(next).filter(({ kind }) => kind === "cub");
    expect(cubs).toHaveLength(2);
    for (const cub of cubs) expect(cub.power).toBe(2);
    expect(eventsOf(next)).toContainEqual({
      kind: "summoned",
      source: who(wolf),
      summoned: "cub",
      count: 2,
    });
    expect(
      games[index + 1]!.events.some(({ kind }) => kind === "summoned"),
    ).toBe(false);
  });
});

describe("conditions", () => {
  test("the player regenerates by permanent conditions, which never wear off", () => {
    const drained = withPlayer(facingEast(), { hp: 1, mp: 0 });
    const history = historyOf(drained, 100);
    expect(playerOf(history.at(-1)!)).toMatchObject({ hp: 11, mp: MAX_MP });
    expect([...playerOf(history.at(-1)!).conditions.keys()]).toEqual([
      "vigor",
      "focus",
    ]);
  });

  test("events carry their cause", () => {
    const next = act(gameWith([creature(east, "troll")]), step("se"));
    expect(next.events).toContainEqual(
      expect.objectContaining({
        kind: "hurt",
        source: ADVENTURER,
        cause: { kind: "deed", deed: "attack" },
      }),
    );
  });
});
