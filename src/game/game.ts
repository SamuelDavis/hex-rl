import { findPath, rngOf, type Bounds } from "procgen";
import { canStep } from "./explorer";
import {
  add,
  centerOf,
  DIRECTIONS,
  directionBetween,
  HEADINGS,
  hexDistance,
  hexKey,
  neighborsOf,
  sameHex,
  type Direction,
  type Hex,
} from "./hex";
import { IDLE, sighted, tetherOf, unsighted, type Mind } from "./mind";
import {
  MONSTERS,
  SPAWNERS,
  spawnerHpOf,
  type MonsterKind,
  type SpawnerKind,
} from "./monsters";
import { canNotice, SIGHT, visibleFrom } from "./sight";
import {
  abilityOf,
  areaOf,
  MELEE_AREAS,
  PLAYER_DAMAGE,
  type AbilityId,
  type Effect,
} from "./abilities";
import type { Spawner, Tile } from "./terrain";
import {
  capacityOf,
  fits,
  loadOf,
  lootOf,
  overflowOf,
  PLACE_NAMES,
  PLACES,
  type Chest,
  type Equipment,
  type Item,
  type Place,
} from "./items";

export const MAX_HP = 20;
export const MAX_MP = 10;
export const ACTIVE_RADIUS = SIGHT + 4;
export const FORGET_RADIUS = ACTIVE_RADIUS + 8;
export const HUNT_RADIUS = 4;
export const SPAWNER_HEAL_INTERVAL = 5;
const WANDER_CHANCE = 0.3;
const HP_REGEN_INTERVAL = 10;
const MP_REGEN_INTERVAL = 2;
const PATH_BUDGET = 200;

export interface Land {
  readonly seed: number;
  readonly spawn: Hex;
  tileAt(hex: Hex): Tile;
  spawnersIn(bounds: Bounds): readonly Spawner[];
}

export interface Player {
  readonly at: Hex;
  readonly facing: Direction;
  readonly hp: number;
  readonly mp: number;
  /** The turn each ability used is ready again. */
  readonly readyAt: ReadonlyMap<AbilityId, number>;
  readonly gold: number;
  readonly pack: readonly Item[];
  readonly equipment: Equipment;
}

export const PLAYER = "player";

export type ActorId = typeof PLAYER | Monster["id"];

export type ActorKind = typeof PLAYER | MonsterKind;

interface Body {
  readonly at: Hex;
  readonly facing: Direction;
}

export interface Monster {
  readonly id: string;
  readonly kind: MonsterKind;
  readonly home: Spawner;
  readonly at: Hex;
  readonly facing: Direction;
  readonly hp: number;
  readonly mind: Mind;
}

export interface SpawnerState {
  readonly readyAt: number;
  readonly hp: number;
  readonly hurtAt: number;
  /** Wrecked spawners stop spawning until fully healed. */
  readonly isWrecked: boolean;
  /** Set when wrecked; the boss emerges once a hex beside the spawner is free. */
  readonly isBossDue: boolean;
}

export interface Game {
  readonly land: Land;
  readonly player: Player;
  readonly monsters: readonly Monster[];
  readonly spawners: ReadonlyMap<string, SpawnerState>;
  /** What lies on the ground, by hex key; a chest is never empty. */
  readonly chests: ReadonlyMap<string, Chest>;
  readonly kills: number;
  readonly seen: ReadonlySet<string>;
  readonly turn: number;
  /** What the action that produced this state did, in order. */
  readonly events: readonly GameEvent[];
}

export interface Move {
  readonly kind: "move";
  readonly direction: Direction;
}

export interface Attack {
  readonly kind: "attack";
  readonly at: Hex;
}

export interface Wait {
  readonly kind: "wait";
}

export interface Use {
  readonly kind: "use";
  readonly ability: AbilityId;
  readonly at?: Hex | undefined;
}

/** `Transfer.cargo` naming all gold held at its origin, rather than an item id. */
export const GOLD = "gold";

/** Where cargo can be: the pack, the chest on the ground underfoot, or a paper-doll place. */
export type Where = "pack" | "ground" | Place;

export interface Transfer {
  readonly kind: "transfer";
  readonly cargo: string;
  readonly to: Where;
}

export type Cargo = Item | { readonly kind: "gold"; readonly amount: number };

export interface Prepare {
  readonly kind: "prepare";
}

export interface Destroy {
  readonly kind: "destroy";
}

export type Action = Move | Attack | Wait | Use | Transfer | Prepare | Destroy;

type Outcome =
  | {
      readonly kind: "performed";
      readonly game: Game;
      readonly spendsTurn: boolean;
    }
  | { readonly kind: "substituted"; readonly action: Action }
  | { readonly kind: "rejected"; readonly reason: Rejection };

type Rule<A extends Action> = (
  game: Game,
  action: A,
  actor: ActorId,
) => Outcome;

const performed = (game: Game, spendsTurn = true): Outcome => ({
  kind: "performed",
  game,
  spendsTurn,
});

const refused = (reason: Rejection): Outcome => ({ kind: "rejected", reason });

export type Rejection =
  | "blocked"
  | "over"
  | "not-ready"
  | "no-mana"
  | "no-target"
  | "out-of-reach"
  | "out-of-range"
  | "out-of-sight"
  | "misfit"
  | "no-item"
  | "full"
  | "no-chest";

export type GameEvent =
  | { readonly kind: "began" }
  | {
      readonly kind: "rejected";
      readonly actor: ActorKind;
      readonly action: Action;
      readonly reason: Rejection;
    }
  | {
      readonly kind: "turned";
      readonly actor: ActorKind;
      readonly facing: Direction;
    }
  | {
      readonly kind: "stepped";
      readonly actor: ActorKind;
      readonly direction: Direction;
      readonly to: Hex;
    }
  | { readonly kind: "used"; readonly ability: AbilityId }
  | { readonly kind: "hitMonster"; readonly monster: MonsterKind }
  | { readonly kind: "killed"; readonly monster: MonsterKind }
  | { readonly kind: "dropped"; readonly monster: MonsterKind }
  | {
      readonly kind: "moved";
      readonly cargo: Cargo;
      readonly from: Where;
      readonly to: Where;
    }
  | { readonly kind: "spilled"; readonly items: readonly Item[] }
  | { readonly kind: "destroyed" }
  | { readonly kind: "prepared" }
  | { readonly kind: "hitSpawner"; readonly spawner: SpawnerKind }
  | { readonly kind: "wrecked"; readonly spawner: SpawnerKind }
  | { readonly kind: "emerged"; readonly monster: MonsterKind }
  | { readonly kind: "struck"; readonly monster: MonsterKind }
  | { readonly kind: "died" };

export const isOver = (game: Game): boolean => game.player.hp <= 0;

export const cooldownOf = (
  { player, turn }: Game,
  ability: AbilityId,
): number => Math.max(0, (player.readyAt.get(ability) ?? 0) - turn);

const stateOf = (game: Game, { kind, at }: Spawner): SpawnerState =>
  game.spawners.get(hexKey(at)) ?? {
    readyAt: 0,
    hp: spawnerHpOf(kind),
    hurtAt: 0,
    isWrecked: false,
    isBossDue: false,
  };

export const spawnerHp = (game: Game, spawner: Spawner): number => {
  const { hp, hurtAt } = stateOf(game, spawner);
  const healed = Math.floor((game.turn - hurtAt) / SPAWNER_HEAL_INTERVAL);
  return Math.min(spawnerHpOf(spawner.kind), hp + healed);
};

export const isWrecked = (game: Game, spawner: Spawner): boolean =>
  stateOf(game, spawner).isWrecked &&
  spawnerHp(game, spawner) < spawnerHpOf(spawner.kind);

const recorded = (game: Game, ...events: GameEvent[]): Game => ({
  ...game,
  events: [...game.events, ...events],
});

const rejected = (
  game: Game,
  actor: ActorId,
  action: Action,
  reason: Rejection,
): Game =>
  recorded(game, {
    kind: "rejected",
    actor: kindOf(game, actor),
    action,
    reason,
  });

const monsterOf = (game: Game, id: Monster["id"]): Monster =>
  game.monsters.find((monster) => monster.id === id)!;

const bodyOf = (game: Game, actor: ActorId): Body =>
  actor === PLAYER ? game.player : monsterOf(game, actor);

const kindOf = (game: Game, actor: ActorId): ActorKind =>
  actor === PLAYER ? PLAYER : monsterOf(game, actor).kind;

export const visibleOf = ({ land, player }: Game): Set<string> =>
  visibleFrom(land.tileAt, player.at, player.facing);

const withSight = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleOf(game)]),
});

const monsterAt = (game: Game, hex: Hex) =>
  game.monsters.find(({ at }) => sameHex(at, hex));

const isOccupied = (game: Game, hex: Hex) =>
  sameHex(hex, game.player.at) || monsterAt(game, hex) !== undefined;

const spawnerAt = (game: Game, hex: Hex) =>
  game.land.spawnersIn(boundsAround(hex, 1)).find(({ at }) => sameHex(at, hex));

const isBlocked = (game: Game, hex: Hex) =>
  isOccupied(game, hex) || spawnerAt(game, hex) !== undefined;

const boundsAround = (hex: Hex, radius: number): Bounds => {
  const { x, y } = centerOf(hex);
  const reach = 2 * radius;
  return { minX: x - reach, minY: y - reach, maxX: x + reach, maxY: y + reach };
};

const withSpawner = (
  game: Game,
  { at }: Spawner,
  state: SpawnerState,
): Game => ({
  ...game,
  spawners: new Map([...game.spawners, [hexKey(at), state]]),
});

const spawnSiteOf = (game: Game, { at }: Spawner): Hex | undefined => {
  const sites = neighborsOf(at).filter(
    (next) => canStep(game.land.tileAt, at, next) && !isBlocked(game, next),
  );
  if (sites.length === 0) return undefined;
  return rngOf(game.land.seed, "spawns").pick(sites, at.q, at.r, game.turn, 3);
};

const spawnedFrom = (
  { land, turn }: Game,
  spawner: Spawner,
  kind: MonsterKind,
  at: Hex,
): Monster => ({
  id: `${hexKey(spawner.at)}@${turn}`,
  kind,
  home: spawner,
  at,
  facing: rngOf(land.seed, "spawns").pick(HEADINGS, at.q, at.r, turn, 2),
  hp: MONSTERS[kind].hp,
  mind: IDLE,
});

const unleashBoss = (game: Game, spawner: Spawner): Game => {
  const { boss } = SPAWNERS[spawner.kind];
  const site = spawnSiteOf(game, spawner);
  if (!site) return game;
  const monster = spawnedFrom(game, spawner, boss, site);
  return recorded(
    withSpawner(
      {
        ...game,
        monsters: [
          ...game.monsters,
          { ...monster, mind: sighted(monster.mind, monster.at, game.player) },
        ],
      },
      spawner,
      { ...stateOf(game, spawner), isBossDue: false },
    ),
    { kind: "emerged", monster: boss },
  );
};

const spawnFrom = (game: Game, spawner: Spawner): Game => {
  const { land, monsters, turn } = game;
  const { kind, at } = spawner;
  const { pool, cap, interval, chance } = SPAWNERS[kind];
  const state = stateOf(game, spawner);
  if (state.isBossDue) return unleashBoss(game, spawner);
  const rng = rngOf(land.seed, "spawns");
  const site = spawnSiteOf(game, spawner);
  if (
    isWrecked(game, spawner) ||
    !site ||
    monsters.filter(({ home }) => sameHex(home.at, at)).length >= cap
  )
    return game;
  const isRevived = state.isWrecked;
  if (
    !isRevived &&
    (turn < state.readyAt || !rng.chance(chance, at.q, at.r, turn))
  )
    return game;
  const monster = spawnedFrom(
    game,
    spawner,
    rng.weighted(pool, at.q, at.r, turn, 1),
    site,
  );
  return withSpawner({ ...game, monsters: [...monsters, monster] }, spawner, {
    ...state,
    readyAt: turn + interval,
    isWrecked: false,
  });
};

const populate = (game: Game): Game => {
  const { land, player } = game;
  const kept = game.monsters.filter(
    ({ at }) => hexDistance(at, player.at) <= FORGET_RADIUS,
  );
  return land
    .spawnersIn(boundsAround(player.at, ACTIVE_RADIUS))
    .filter(({ at }) => hexDistance(at, player.at) <= ACTIVE_RADIUS)
    .reduce(spawnFrom, { ...game, monsters: kept });
};

export const newGame = (land: Land): Game =>
  withSight(
    populate({
      land,
      player: {
        at: land.spawn,
        facing: "n",
        hp: MAX_HP,
        mp: MAX_MP,
        readyAt: new Map(),
        gold: 0,
        pack: [],
        equipment: {},
      },
      monsters: [],
      spawners: new Map(),
      chests: new Map(),
      kills: 0,
      seen: new Set(),
      turn: 0,
      events: [{ kind: "began" }],
    }),
  );

const chestAt = (game: Game, at: Hex): Chest | undefined =>
  game.chests.get(hexKey(at));

const withChest = (game: Game, at: Hex, { gold, items }: Chest): Game => {
  const chests = new Map(game.chests);
  if (gold > 0 || items.length > 0) chests.set(hexKey(at), { gold, items });
  else chests.delete(hexKey(at));
  return { ...game, chests };
};

const piledOn = (game: Game, at: Hex, { gold, items }: Chest): Game => {
  const pile = chestAt(game, at) ?? { gold: 0, items: [] };
  return withChest(game, at, {
    gold: pile.gold + gold,
    items: [...pile.items, ...items],
  });
};

const dropLoot = (game: Game, monster: Monster): Game => {
  const loot = lootOf(game.land.seed, monster);
  if (!loot) return game;
  return recorded(piledOn(game, monster.at, loot), {
    kind: "dropped",
    monster: monster.kind,
  });
};

const EMPTY: Chest = { gold: 0, items: [] };

const underfoot = (game: Game): Chest => chestAt(game, game.player.at) ?? EMPTY;

const isPlace = (where: Where): where is Place => where in PLACES;

const withPlayer = (game: Game, change: Partial<Player>): Game => ({
  ...game,
  player: { ...game.player, ...change },
});

const locate = (game: Game, id: string): readonly [Item, Where] | undefined => {
  const { pack, equipment } = game.player;
  const isIt = (item: Item | undefined) => item?.id === id;
  const packed = pack.find(isIt);
  if (packed) return [packed, "pack"];
  const lying = underfoot(game).items.find(isIt);
  if (lying) return [lying, "ground"];
  const place = PLACE_NAMES.find((place) => isIt(equipment[place]));
  return place && [equipment[place]!, place];
};

const removed = (game: Game, item: Item, from: Where): Game => {
  const { pack, equipment, at } = game.player;
  if (from === "pack")
    return withPlayer(game, { pack: pack.filter((held) => held !== item) });
  if (from === "ground") {
    const chest = underfoot(game);
    const items = chest.items.filter((held) => held !== item);
    return withChest(game, at, { ...chest, items });
  }
  return withPlayer(game, {
    equipment: Object.fromEntries(
      Object.entries(equipment).filter(([place]) => place !== from),
    ),
  });
};

const added = (game: Game, item: Item, to: Where): Game => {
  const { pack, equipment, at } = game.player;
  if (to === "pack") return withPlayer(game, { pack: [...pack, item] });
  if (to === "ground") return piledOn(game, at, { gold: 0, items: [item] });
  return withPlayer(game, { equipment: { ...equipment, [to]: item } });
};

const relocated = (game: Game, item: Item, from: Where, to: Where): Game =>
  added(removed(game, item, from), item, to);

const spilled = (game: Game): Game => {
  const { pack, equipment, at } = game.player;
  const rng = rngOf(game.land.seed, "spill", game.turn);
  const { kept, spilled } = overflowOf(pack, capacityOf(equipment), rng);
  if (spilled.length === 0) return game;
  return recorded(
    piledOn(withPlayer(game, { pack: kept }), at, { gold: 0, items: spilled }),
    { kind: "spilled", items: spilled },
  );
};

const transferGold = (game: Game, action: Transfer): Outcome => {
  const { to } = action;
  const { player } = game;
  if (isPlace(to)) return refused("misfit");
  const chest = underfoot(game);
  const from = to === "pack" ? "ground" : "pack";
  const amount = to === "pack" ? chest.gold : player.gold;
  if (amount === 0) return refused("no-item");
  const gold = to === "pack" ? player.gold + amount : 0;
  const lying = to === "pack" ? 0 : chest.gold + amount;
  return performed(
    recorded(
      withChest(withPlayer(game, { gold }), player.at, {
        ...chest,
        gold: lying,
      }),
      { kind: "moved", cargo: { kind: "gold", amount }, from, to },
    ),
  );
};

const transferItem = (game: Game, action: Transfer): Outcome => {
  const found = locate(game, action.cargo);
  if (!found) return refused("no-item");
  const [item, from] = found;
  const { to } = action;
  if (from === to || (isPlace(to) && !fits(item, to))) return refused("misfit");
  const worn = isPlace(to) ? game.player.equipment[to] : undefined;
  const swapped = worn ? relocated(game, worn, to, from) : game;
  const next = relocated(swapped, item, from, to);
  const capacity = capacityOf(next.player.equipment);
  const isOver = loadOf(next.player.pack) > capacity;
  if (isOver && capacity >= capacityOf(game.player.equipment))
    return refused("full");
  return performed(
    spilled(recorded(next, { kind: "moved", cargo: item, from, to })),
  );
};

const transfer: Rule<Transfer> = (game, action) =>
  action.cargo === GOLD
    ? transferGold(game, action)
    : transferItem(game, action);

const destroy: Rule<Destroy> = (game) => {
  if (!chestAt(game, game.player.at)) return refused("no-chest");
  return performed(
    recorded(withChest(game, game.player.at, EMPTY), { kind: "destroyed" }),
  );
};

const attackMonster = (game: Game, target: Monster, damage: number): Game => {
  const hp = target.hp - damage;
  if (hp > 0)
    return recorded(
      {
        ...game,
        monsters: game.monsters.map((m) => (m === target ? { ...m, hp } : m)),
      },
      { kind: "hitMonster", monster: target.kind },
    );
  return dropLoot(
    recorded(
      {
        ...game,
        monsters: game.monsters.filter((m) => m !== target),
        kills: game.kills + 1,
      },
      { kind: "killed", monster: target.kind },
    ),
    target,
  );
};

const attackSpawner = (game: Game, spawner: Spawner, damage: number): Game => {
  const hp = Math.max(0, spawnerHp(game, spawner) - damage);
  const wasWrecked = isWrecked(game, spawner);
  const hurt = (change: Partial<SpawnerState>) =>
    withSpawner(game, spawner, {
      ...stateOf(game, spawner),
      hp,
      hurtAt: game.turn,
      ...change,
    });
  if (hp > 0 || wasWrecked)
    return recorded(hurt({ isWrecked: wasWrecked }), {
      kind: "hitSpawner",
      spawner: spawner.kind,
    });
  return recorded(hurt({ isWrecked: true, isBossDue: true }), {
    kind: "wrecked",
    spawner: spawner.kind,
  });
};

const struck = (game: Game, monster: Monster): Game => {
  const hp = game.player.hp - MONSTERS[monster.kind].damage;
  return recorded(
    withPlayer(game, { hp }),
    { kind: "struck", monster: monster.kind },
    ...(hp > 0 ? [] : [{ kind: "died" } as const]),
  );
};

const hit = (game: Game, at: Hex, damage: number): Game => {
  const target = monsterAt(game, at);
  if (target) return attackMonster(game, target, damage);
  const spawner = spawnerAt(game, at);
  if (spawner) return attackSpawner(game, spawner, damage);
  return game;
};

const isInReach = ({ land }: Game, from: Hex, at: Hex): boolean =>
  canStep(land.tileAt, from, at);

const applied = (game: Game, effect: Effect, at: Hex | undefined): Game => {
  const { player } = game;
  switch (effect.kind) {
    case "face":
      return withPlayer(game, { facing: directionBetween(player.at, at!)! });
    case "damage":
      return areaOf(effect.area, player.at, player.facing, at)
        .filter(
          (hex) =>
            !MELEE_AREAS.has(effect.area) || isInReach(game, player.at, hex),
        )
        .reduce((state, hex) => hit(state, hex, effect.amount), game);
    case "restore": {
      const max = effect.stat === "hp" ? MAX_HP : MAX_MP;
      return withPlayer(game, {
        [effect.stat]: Math.min(max, player[effect.stat] + effect.amount),
      });
    }
  }
};

const reachProblemOf = (
  game: Game,
  from: Hex,
  at: Hex,
): Rejection | undefined => {
  const isAdjacent = directionBetween(from, at) !== undefined;
  if (!isAdjacent || !isInReach(game, from, at)) return "out-of-reach";
  return undefined;
};

const aimProblemOf = (
  game: Game,
  { ability, at }: Use,
): Rejection | undefined => {
  const { aim } = abilityOf(ability);
  if (aim.kind === "monster") {
    const target = at && monsterAt(game, at);
    if (!target) return "no-target";
    return reachProblemOf(game, game.player.at, target.at);
  }
  if (aim.kind === "hex") {
    if (!at || hexDistance(game.player.at, at) > aim.range)
      return "out-of-range";
    if (!visibleOf(game).has(hexKey(at))) return "out-of-sight";
  }
  return undefined;
};

const supplyOf = ({ player }: Game, id: AbilityId): Item | undefined => {
  const { consumes } = abilityOf(id);
  return player.pack.find(
    (item) => item.kind === "potion" && item.potion === consumes,
  );
};

export const unreadinessOf = (
  game: Game,
  id: AbilityId,
): Rejection | undefined => {
  const { mp, consumes } = abilityOf(id);
  if (cooldownOf(game, id) > 0) return "not-ready";
  if (game.player.mp < mp) return "no-mana";
  if (consumes && !supplyOf(game, id)) return "no-item";
  return undefined;
};

const spent = (game: Game, id: AbilityId): Game => {
  const { player, turn } = game;
  const { mp, cooldown } = abilityOf(id);
  const supply = supplyOf(game, id);
  return withPlayer(game, {
    mp: player.mp - mp,
    pack: player.pack.filter((item) => item !== supply),
    readyAt:
      cooldown > 0
        ? new Map([...player.readyAt, [id, turn + 1 + cooldown]])
        : player.readyAt,
  });
};

const use: Rule<Use> = (game, action) => {
  const problem =
    unreadinessOf(game, action.ability) ?? aimProblemOf(game, action);
  if (problem) return refused(problem);
  const { effects, spendsTurn } = abilityOf(action.ability);
  const used = recorded(spent(game, action.ability), {
    kind: "used",
    ability: action.ability,
  });
  return performed(
    effects.reduce((state, effect) => applied(state, effect, action.at), used),
    spendsTurn,
  );
};

const stepToward = (
  game: Game,
  monster: Monster,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const route = findPath({
    start: monster.at,
    isGoal: (hex) => hexDistance(hex, goal) <= reach,
    neighbors: (hex) =>
      neighborsOf(hex).filter(
        (next) =>
          canStep(game.land.tileAt, hex, next) && !isBlocked(game, next),
      ),
    cost: () => 1,
    heuristic: (hex) => Math.max(0, hexDistance(hex, goal) - reach),
    keyOf: hexKey,
    maxExpansions: PATH_BUDGET,
  });
  return "path" in route ? route.path[1] : undefined;
};

const updated = (
  game: Game,
  id: Monster["id"],
  change: Partial<Monster>,
): Game => ({
  ...game,
  monsters: game.monsters.map((m) => (m.id === id ? { ...m, ...change } : m)),
});

const withBody = (game: Game, actor: ActorId, change: Partial<Body>): Game =>
  actor === PLAYER ? withPlayer(game, change) : updated(game, actor, change);

interface Leash {
  readonly center: Hex;
  readonly radius: number;
}

const leashOf = ({ home, mind }: Monster): Leash => ({
  center: tetherOf(mind, home.at),
  radius: SPAWNERS[home.kind].leash,
});

const isWithin = (hex: Hex, { center, radius }: Leash) =>
  hexDistance(hex, center) <= radius;

const alignment = (from: Hex, to: Hex, heading: Direction | undefined) => {
  if (!heading) return 1;
  const step = centerOf({ q: to.q - from.q, r: to.r - from.r });
  const ahead = centerOf(DIRECTIONS[heading]);
  const dot =
    (step.x * ahead.x + step.y * ahead.y) / (step.x * step.x + step.y * step.y);
  return (1 + dot) * (1 + dot) + 0.1;
};

const wander = (
  game: Game,
  monster: Monster,
  area: Leash,
  chance: number,
  heading?: Direction,
): Hex | undefined => {
  const { at, id } = monster;
  const rng = rngOf(game.land.seed, "wander").child(id);
  if (!rng.chance(chance, game.turn)) return undefined;
  const options = neighborsOf(at)
    .filter(
      (next) =>
        isWithin(next, area) &&
        isWithin(next, leashOf(monster)) &&
        canStep(game.land.tileAt, at, next) &&
        !isBlocked(game, next),
    )
    .map((next) => [next, alignment(at, next, heading)] as const);
  if (options.length === 0) return undefined;
  return rng.weighted(options, game.turn, 1);
};

const mindOf = ({ land, player }: Game, { at, facing, mind }: Monster): Mind =>
  canNotice(land.tileAt, at, facing, player.at)
    ? sighted(mind, at, player)
    : unsighted(mind, at);

const approach = (
  game: Game,
  monster: Monster,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const step = stepToward(game, monster, goal, reach);
  return step && isWithin(step, leashOf(monster)) ? step : undefined;
};

const destinationOf = (game: Game, monster: Monster): Hex | undefined => {
  const { mind, at, home } = monster;
  switch (mind.state) {
    case "idle": {
      const leash = leashOf(monster);
      return isWithin(at, leash)
        ? wander(game, monster, leash, WANDER_CHANCE)
        : stepToward(game, monster, home.at, leash.radius);
    }
    case "hostile":
      return approach(
        game,
        monster,
        mind.lastSeen,
        isBlocked(game, mind.lastSeen) ? 1 : 0,
      );
    case "hunting": {
      const area = { center: mind.lastSeen, radius: HUNT_RADIUS };
      return isWithin(at, area)
        ? wander(game, monster, area, 1, mind.heading)
        : approach(game, monster, mind.lastSeen, HUNT_RADIUS);
    }
  }
};

const toward = ({ at }: Monster, to: Hex | undefined): Action => {
  const direction = to && directionBetween(at, to);
  return direction ? { kind: "move", direction } : { kind: "wait" };
};

const choiceOf = (game: Game, monster: Monster): Action => {
  const { land, player } = game;
  const isBeside =
    directionBetween(monster.at, player.at) !== undefined &&
    canStep(land.tileAt, monster.at, player.at);
  return monster.mind.state === "hostile" && isBeside
    ? toward(monster, player.at)
    : toward(monster, destinationOf(game, monster));
};

const monsterTurn = (game: Game, monster: Monster): Game => {
  if (isOver(game)) return game;
  const aware = { ...monster, mind: mindOf(game, monster) };
  const minded = updated(game, aware.id, { mind: aware.mind });
  return settled(minded, aware.id, choiceOf(minded, aware)).game;
};

const monstersTurn = (game: Game): Game =>
  game.monsters.reduce(
    (state, { id }) => monsterTurn(state, monsterOf(state, id)),
    game,
  );

const restored = (
  value: number,
  max: number,
  interval: number,
  turn: number,
) => (turn % interval === 0 ? Math.min(max, value + 1) : value);

const regenerate = (game: Game): Game => {
  if (isOver(game)) return game;
  const { player, turn } = game;
  return {
    ...game,
    player: {
      ...player,
      hp: restored(player.hp, MAX_HP, HP_REGEN_INTERVAL, turn),
      mp: restored(player.mp, MAX_MP, MP_REGEN_INTERVAL, turn),
    },
  };
};

const endTurn = (acted: Game): Game =>
  withSight(
    populate(regenerate(monstersTurn({ ...acted, turn: acted.turn + 1 }))),
  );

const move: Rule<Move> = (game, { direction }, actor) => {
  const { at, facing } = bodyOf(game, actor);
  const kind = kindOf(game, actor);
  if (direction !== facing)
    return performed(
      recorded(withBody(game, actor, { facing: direction }), {
        kind: "turned",
        actor: kind,
        facing: direction,
      }),
    );
  const to = add(at, DIRECTIONS[direction]);
  if (!canStep(game.land.tileAt, at, to)) return refused("blocked");
  if (isBlocked(game, to))
    return { kind: "substituted", action: { kind: "attack", at: to } };
  return performed(
    recorded(withBody(game, actor, { at: to }), {
      kind: "stepped",
      actor: kind,
      direction,
      to,
    }),
  );
};

const isFoeAt = (game: Game, actor: ActorId, at: Hex): boolean =>
  actor === PLAYER
    ? monsterAt(game, at) !== undefined || spawnerAt(game, at) !== undefined
    : sameHex(at, game.player.at);

const attack: Rule<Attack> = (game, { at }, actor) => {
  if (!isFoeAt(game, actor, at)) return refused("no-target");
  const problem = reachProblemOf(game, bodyOf(game, actor).at, at);
  if (problem) return refused(problem);
  return performed(
    actor === PLAYER
      ? hit(game, at, PLAYER_DAMAGE)
      : struck(game, monsterOf(game, actor)),
  );
};

const RULES: {
  readonly [K in Action["kind"]]: Rule<Extract<Action, { kind: K }>>;
} = {
  move,
  attack,
  wait: (game) => performed(game),
  use,
  transfer,
  prepare: (game) => performed(recorded(game, { kind: "prepared" })),
  destroy,
};

interface Settlement {
  readonly game: Game;
  readonly spendsTurn: boolean;
}

const outcomeOf = <A extends Action>(
  game: Game,
  action: A,
  actor: ActorId,
): Outcome => (RULES[action.kind] as Rule<A>)(game, action, actor);

const settled = (game: Game, actor: ActorId, action: Action): Settlement => {
  const outcome = outcomeOf(game, action, actor);
  switch (outcome.kind) {
    case "rejected":
      return {
        game: rejected(game, actor, action, outcome.reason),
        spendsTurn: false,
      };
    case "substituted":
      return settled(game, actor, outcome.action);
    case "performed":
      return outcome;
  }
};

const resolve = (game: Game, action: Action): Game => {
  const { game: next, spendsTurn } = settled(game, PLAYER, action);
  return spendsTurn ? endTurn(next) : next;
};

export const act = (game: Game, action: Action): Game =>
  isOver(game)
    ? rejected({ ...game, events: [] }, PLAYER, action, "over")
    : resolve({ ...game, events: [] }, action);
