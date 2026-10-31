import { findPath, rngOf, type Bounds, type Rng } from "procgen";
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
  bossOf,
  CREATURE_SPELLS,
  CREATURES,
  potencyOf,
  SERVICES,
  spawnerHpOf,
  spawnerOf,
  type Affliction,
  type Faction,
  type CreatureKind,
  type SpawnerKind,
} from "./creatures";
import { canNotice, SIGHT, visibleFrom } from "./sight";
import {
  abilityOf,
  areaOf,
  isSpell,
  MELEE_AREAS,
  PLAYER_DAMAGE,
  type AbilityId,
  type Effect,
  type SpellId,
} from "./abilities";
import { dangerOf, type Biome, type Spawner, type Tile } from "./terrain";
import {
  capacityOf,
  fits,
  loadOf,
  lootOf,
  offerOf,
  overflowOf,
  priceOf,
  sizeOf,
  takenOf,
  waresOf,
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
export const XP_PER_LEVEL = 10;
export const BOUNTY_GOLD_PER_LEVEL = 25;
/** Widening radii the bailiff searches for a lair to post as a bounty. */
const BOUNTY_SEARCH = [16, 32, 64, 128] as const;

export interface Land {
  readonly seed: number;
  readonly spawn: Hex;
  tileAt(hex: Hex): Tile;
  spawnersIn(bounds: Bounds): readonly Spawner[];
}

export const PLAYER = "player";

/** Unique per actor; the player's is `PLAYER`. */
export type ActorId = string;

export type ActorKind = typeof PLAYER | CreatureKind;

/** What every actor shares: the player, monsters and townsfolk, all acted for by the same Rules. */
export interface Actor {
  readonly id: ActorId;
  readonly at: Hex;
  readonly facing: Direction;
  readonly hp: number;
}

export interface Player extends Actor {
  readonly id: typeof PLAYER;
  readonly mp: number;
  /** The turn each ability used is ready again. */
  readonly readyAt: ReadonlyMap<AbilityId, number>;
  readonly gold: number;
  readonly pack: readonly Item[];
  readonly equipment: Equipment;
  readonly xp: number;
  /** Level of each spell learned; unlearned spells are absent. */
  readonly spells: ReadonlyMap<SpellId, number>;
  /** The turn each affliction suffered wears off. */
  readonly afflictions: ReadonlyMap<Affliction, number>;
  readonly bounty: Bounty | undefined;
  /** Level of the last bounty claimed; each new one is posted at a higher level. */
  readonly bountyLevel: number;
}

/** A bailiff's charge: slay the boss of the lair at `at`, then return to any bailiff. */
export interface Bounty {
  readonly kind: SpawnerKind;
  readonly at: Hex;
  readonly level: number;
  readonly isSlain: boolean;
}

/** A non-player actor: a wild monster or townsfolk, by its home's faction. */
export interface Creature extends Actor {
  readonly kind: CreatureKind;
  readonly home: Spawner;
  readonly mind: Mind;
  /** Scales damage, spell potency and experience granted linearly. */
  readonly level: number;
  /** The turn its spell, if any, is ready again. */
  readonly readyAt: number;
  /** What it sells, if a trader. */
  readonly wares: readonly Item[];
  /** Gold it can pay for wares, if a trader. */
  readonly purse: number;
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
  readonly creatures: readonly Creature[];
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

export interface Turn {
  readonly kind: "turn";
  readonly direction: Direction;
}

export interface Step {
  readonly kind: "step";
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

export interface TakeAll {
  readonly kind: "take-all";
}

export interface Destroy {
  readonly kind: "destroy";
}

export interface Learn {
  readonly kind: "learn";
  readonly spell: SpellId;
}

export interface Summon {
  readonly kind: "summon";
}

export interface Restock {
  readonly kind: "restock";
}

export interface Interact {
  readonly kind: "interact";
  readonly at?: Hex | undefined;
}

/** Sells `item` from the pack to `trader`, or buys it from the trader's wares. */
export interface Trade {
  readonly kind: "trade";
  readonly trader: Creature["id"];
  readonly item: Item["id"];
}

type Deed =
  | Turn
  | Step
  | Attack
  | Wait
  | Use
  | Transfer
  | TakeAll
  | Prepare
  | Destroy
  | Learn
  | Summon
  | Restock
  | Interact
  | Trade;

export type Intent = Move | Deed;

export interface Plan {
  readonly attempt: Deed;
  readonly otherwise?: { readonly [R in Rejection]?: Plan };
}

type Outcome =
  | {
      readonly kind: "performed";
      readonly game: Game;
      readonly spendsTurn: boolean;
    }
  | { readonly kind: "rejected"; readonly reason: Rejection };

type Rule<A extends Deed> = (game: Game, action: A, actor: ActorId) => Outcome;

const performed = (game: Game, spendsTurn = true): Outcome => ({
  kind: "performed",
  game,
  spendsTurn,
});

const refused = (reason: Rejection): Outcome => ({ kind: "rejected", reason });

export type Rejection =
  | "blocked"
  | "occupied"
  | "not-facing"
  | "already-facing"
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
  | "no-chest"
  | "unlearned"
  | "no-unlocks"
  | "stunned"
  | "paralyzed"
  | "friendly"
  | "uninterested"
  | "no-gold"
  | "unable";

/** Who an event concerns: enough to name them and tell them apart. */
export interface Who {
  readonly id: ActorId;
  readonly kind: ActorKind;
  readonly faction: Faction;
  /** Biome of a creature's home; townsfolk are known by it. */
  readonly biome?: Biome;
}

/** Every event names its `actor`, who did it or to whom it happened; `target`, if any, is who it was done to. */
export type GameEvent =
  | { readonly kind: "began"; readonly actor: Who }
  | {
      readonly kind: "rejected";
      readonly actor: Who;
      readonly action: Intent;
      readonly reason: Rejection;
    }
  | {
      readonly kind: "turned";
      readonly actor: Who;
      readonly facing: Direction;
    }
  | {
      readonly kind: "stepped";
      readonly actor: Who;
      readonly direction: Direction;
      readonly to: Hex;
    }
  | { readonly kind: "used"; readonly actor: Who; readonly ability: AbilityId }
  | { readonly kind: "hit"; readonly actor: Who; readonly target: Who }
  | { readonly kind: "killed"; readonly actor: Who; readonly target: Who }
  | { readonly kind: "dropped"; readonly actor: Who }
  | {
      readonly kind: "moved";
      readonly actor: Who;
      readonly cargo: Cargo;
      readonly from: Where;
      readonly to: Where;
    }
  | {
      readonly kind: "spilled";
      readonly actor: Who;
      readonly items: readonly Item[];
    }
  | { readonly kind: "destroyed"; readonly actor: Who }
  | { readonly kind: "prepared"; readonly actor: Who }
  | {
      readonly kind: "hitSpawner";
      readonly actor: Who;
      readonly spawner: SpawnerKind;
    }
  | {
      readonly kind: "wrecked";
      readonly actor: Who;
      readonly spawner: SpawnerKind;
    }
  | { readonly kind: "emerged"; readonly actor: Who }
  | { readonly kind: "leveled"; readonly actor: Who; readonly level: number }
  | {
      readonly kind: "learned";
      readonly actor: Who;
      readonly spell: SpellId;
      readonly level: number;
    }
  | {
      readonly kind: "summoned";
      readonly actor: Who;
      readonly summoned: CreatureKind;
      readonly count: number;
    }
  | {
      readonly kind: "afflicted";
      readonly actor: Who;
      readonly target: Who;
      readonly affliction: Affliction;
      readonly turns: number;
    }
  | { readonly kind: "bled"; readonly actor: Who }
  | { readonly kind: "died"; readonly actor: Who }
  | { readonly kind: "restocked"; readonly actor: Who }
  | { readonly kind: "interacted"; readonly actor: Who; readonly target: Who }
  | {
      readonly kind: "bought" | "sold";
      readonly actor: Who;
      readonly target: Who;
      readonly item: Item;
      readonly price: number;
    }
  | {
      readonly kind: "bountied";
      readonly actor: Who;
      readonly target: Who;
      readonly spawner: SpawnerKind;
      readonly at: Hex;
      readonly level: number;
    }
  | { readonly kind: "bountySlain"; readonly actor: Who; readonly target: Who }
  | {
      readonly kind: "rewarded";
      readonly actor: Who;
      readonly target: Who;
      readonly gold: number;
    };

export const isOver = (game: Game): boolean => game.player.hp <= 0;

export const levelOf = ({ xp }: Player): number =>
  1 + Math.floor(xp / XP_PER_LEVEL);

export const spellLevelOf = ({ spells }: Player, spell: SpellId): number =>
  spells.get(spell) ?? 0;

/** Levels gained but not yet spent learning a spell. */
export const unlocksOf = (player: Player): number =>
  levelOf(player) -
  1 -
  [...player.spells.values()].reduce((sum, level) => sum + level, 0);

/** Effect multiplier: a spell's level; potions are always 1. */
const masteryOf = (player: Player, id: AbilityId): number =>
  isSpell(id) ? spellLevelOf(player, id) : 1;

export const afflictionOf = (
  { player, turn }: Game,
  affliction: Affliction,
): number => Math.max(0, (player.afflictions.get(affliction) ?? 0) - turn);

const isAfflicted = (game: Game, actor: ActorId, affliction: Affliction) =>
  actor === PLAYER && afflictionOf(game, affliction) > 0;

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
  action: Intent,
  reason: Rejection,
): Game =>
  recorded(game, {
    kind: "rejected",
    actor: whoOf(game, actor),
    action,
    reason,
  });

const creatureOf = (game: Game, id: Creature["id"]): Creature =>
  game.creatures.find((creature) => creature.id === id)!;

const actorOf = (game: Game, actor: ActorId): Player | Creature =>
  actor === PLAYER ? game.player : creatureOf(game, actor);

const THE_PLAYER: Who = { id: PLAYER, kind: PLAYER, faction: "town" };

const whoIs = ({ land }: Game, actor: Player | Creature): Who =>
  "home" in actor
    ? {
        id: actor.id,
        kind: actor.kind,
        faction: factionOfCreature(actor),
        biome: land.tileAt(actor.home.at).biome,
      }
    : THE_PLAYER;

export const whoOf = (game: Game, actor: ActorId): Who =>
  whoIs(game, actorOf(game, actor));

export const factionOfCreature = ({ home }: Creature): Faction =>
  spawnerOf(home.kind).faction;

const factionOf = (game: Game, actor: ActorId): Faction =>
  actor === PLAYER ? "town" : factionOfCreature(creatureOf(game, actor));

const areFoes = (game: Game, a: ActorId, b: ActorId): boolean =>
  factionOf(game, a) !== factionOf(game, b);

export const visibleOf = ({ land, player }: Game): Set<string> =>
  visibleFrom(land.tileAt, player.at, player.facing);

const withSight = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleOf(game)]),
});

const creatureAt = (game: Game, hex: Hex) =>
  game.creatures.find(({ at }) => sameHex(at, hex));

const occupantAt = (game: Game, hex: Hex): ActorId | undefined =>
  sameHex(hex, game.player.at) ? PLAYER : creatureAt(game, hex)?.id;

const isOccupied = (game: Game, hex: Hex) =>
  occupantAt(game, hex) !== undefined;

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
  kind: CreatureKind,
  at: Hex,
): Creature => ({
  id: `${hexKey(spawner.at)}@${turn}`,
  kind,
  home: spawner,
  at,
  facing: rngOf(land.seed, "spawns").pick(HEADINGS, at.q, at.r, turn, 2),
  hp: CREATURES[kind].hp,
  mind: IDLE,
  level: dangerOf(spawner.at, land.spawn),
  readyAt: 0,
  wares: [],
  purse: 0,
});

const unleashBoss = (game: Game, spawner: Spawner): Game => {
  const boss = bossOf(spawner.kind);
  const site = spawnSiteOf(game, spawner);
  if (!boss || !site) return game;
  const creature = spawnedFrom(game, spawner, boss, site);
  return recorded(
    withSpawner(
      {
        ...game,
        creatures: [
          ...game.creatures,
          {
            ...creature,
            mind: sighted(creature.mind, creature.at, game.player),
          },
        ],
      },
      spawner,
      { ...stateOf(game, spawner), isBossDue: false },
    ),
    { kind: "emerged", actor: whoIs(game, creature) },
  );
};

/** The kind `spawner` would spawn now, if it has room for one. */
const recruitOf = (
  { creatures, turn }: Game,
  { kind, at }: Spawner,
  rng: Rng,
): CreatureKind | undefined => {
  const members = creatures.filter(({ home }) => sameHex(home.at, at));
  const type = spawnerOf(kind);
  if (type.faction === "wild")
    return members.length < type.cap
      ? rng.weighted(type.pool, at.q, at.r, turn, 1)
      : undefined;
  return type.roster.find(
    ([recruit, count]) =>
      members.filter((member) => member.kind === recruit).length < count,
  )?.[0];
};

const spawnFrom = (game: Game, spawner: Spawner): Game => {
  const { land, creatures, turn } = game;
  const { kind, at } = spawner;
  const { interval, chance } = spawnerOf(kind);
  const state = stateOf(game, spawner);
  if (state.isBossDue) return unleashBoss(game, spawner);
  const rng = rngOf(land.seed, "spawns");
  const site = spawnSiteOf(game, spawner);
  const recruit = recruitOf(game, spawner, rng);
  if (isWrecked(game, spawner) || !site || !recruit) return game;
  const isRevived = state.isWrecked;
  if (
    !isRevived &&
    (turn < state.readyAt || !rng.chance(chance, at.q, at.r, turn))
  )
    return game;
  const creature = spawnedFrom(game, spawner, recruit, site);
  return withSpawner(
    { ...game, creatures: [...creatures, creature] },
    spawner,
    {
      ...state,
      readyAt: turn + interval,
      isWrecked: false,
    },
  );
};

const populate = (game: Game): Game => {
  const { land, player } = game;
  const kept = game.creatures.filter(
    ({ at }) => hexDistance(at, player.at) <= FORGET_RADIUS,
  );
  return land
    .spawnersIn(boundsAround(player.at, ACTIVE_RADIUS))
    .filter(({ at }) => hexDistance(at, player.at) <= ACTIVE_RADIUS)
    .reduce(spawnFrom, { ...game, creatures: kept });
};

export const newGame = (land: Land): Game =>
  withSight(
    populate({
      land,
      player: {
        id: PLAYER,
        at: land.spawn,
        facing: "n",
        hp: MAX_HP,
        mp: MAX_MP,
        readyAt: new Map(),
        gold: 0,
        pack: [],
        equipment: {},
        xp: 0,
        spells: new Map(),
        afflictions: new Map(),
        bounty: undefined,
        bountyLevel: 0,
      },
      creatures: [],
      spawners: new Map(),
      chests: new Map(),
      kills: 0,
      seen: new Set(),
      turn: 0,
      events: [{ kind: "began", actor: THE_PLAYER }],
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

const dropLoot = (game: Game, creature: Creature): Game => {
  const loot = lootOf(game.land.seed, creature);
  if (!loot) return game;
  return recorded(piledOn(game, creature.at, loot), {
    kind: "dropped",
    actor: whoIs(game, creature),
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
    { kind: "spilled", actor: THE_PLAYER, items: spilled },
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
      {
        kind: "moved",
        actor: THE_PLAYER,
        cargo: { kind: "gold", amount },
        from,
        to,
      },
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
    spilled(
      recorded(next, {
        kind: "moved",
        actor: THE_PLAYER,
        cargo: item,
        from,
        to,
      }),
    ),
  );
};

const transfer: Rule<Transfer> = (game, action) =>
  action.cargo === GOLD
    ? transferGold(game, action)
    : transferItem(game, action);

const takeAll: Rule<TakeAll> = (game) => {
  const { at, pack, equipment, gold } = game.player;
  const chest = chestAt(game, at);
  if (!chest) return refused("no-chest");
  const room = capacityOf(equipment) - loadOf(pack);
  const rng = rngOf(game.land.seed, "take", game.turn);
  const taken = takenOf(chest.items, room, rng);
  if (chest.gold === 0 && taken.length === 0) return refused("full");
  const cargo: readonly Cargo[] = [
    ...(chest.gold > 0 ? [{ kind: "gold", amount: chest.gold } as const] : []),
    ...taken,
  ];
  const next = withChest(
    withPlayer(game, { gold: gold + chest.gold, pack: [...pack, ...taken] }),
    at,
    { gold: 0, items: chest.items.filter((item) => !taken.includes(item)) },
  );
  return performed(
    cargo.reduce(
      (taking, moved) =>
        recorded(taking, {
          kind: "moved",
          actor: THE_PLAYER,
          cargo: moved,
          from: "ground",
          to: "pack",
        }),
      next,
    ),
  );
};

const destroy: Rule<Destroy> = (game) => {
  if (!chestAt(game, game.player.at)) return refused("no-chest");
  return performed(
    recorded(withChest(game, game.player.at, EMPTY), {
      kind: "destroyed",
      actor: THE_PLAYER,
    }),
  );
};

const attackCreature = (
  game: Game,
  by: ActorId,
  target: Creature,
  damage: number,
): Game => {
  const actor = whoOf(game, by);
  const victim = whoIs(game, target);
  const hp = target.hp - damage;
  if (hp > 0)
    return recorded(updated(game, target.id, { hp }), {
      kind: "hit",
      actor,
      target: victim,
    });
  const slain = recorded(
    { ...game, creatures: game.creatures.filter((m) => m !== target) },
    { kind: "killed", actor, target: victim },
  );
  return dropLoot(by === PLAYER ? credited(slain, target) : slain, target);
};

const credited = (game: Game, slain: Creature): Game =>
  bountyHunted(
    experienced(
      { ...game, kills: game.kills + 1 },
      CREATURES[slain.kind].hp * slain.level,
    ),
    slain,
  );

const bountyHunted = (game: Game, slain: Creature): Game => {
  const { kind, home } = slain;
  const { bounty } = game.player;
  if (
    !bounty ||
    bounty.isSlain ||
    !sameHex(bounty.at, home.at) ||
    bossOf(bounty.kind) !== kind
  )
    return game;
  return recorded(withPlayer(game, { bounty: { ...bounty, isSlain: true } }), {
    kind: "bountySlain",
    actor: THE_PLAYER,
    target: whoIs(game, slain),
  });
};

const experienced = (game: Game, xp: number): Game => {
  const before = levelOf(game.player);
  const next = withPlayer(game, { xp: game.player.xp + xp });
  const level = levelOf(next.player);
  return level > before
    ? recorded(next, { kind: "leveled", actor: THE_PLAYER, level })
    : next;
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
      actor: THE_PLAYER,
      spawner: spawner.kind,
    });
  return recorded(hurt({ isWrecked: true, isBossDue: true }), {
    kind: "wrecked",
    actor: THE_PLAYER,
    spawner: spawner.kind,
  });
};

const hurt = (game: Game, damage: number): Game => {
  const hp = game.player.hp - damage;
  const next = withPlayer(game, { hp });
  return hp > 0 ? next : recorded(next, { kind: "died", actor: THE_PLAYER });
};

const afflicted = (game: Game, creature: Creature): Game => {
  const spell = CREATURE_SPELLS[creature.kind];
  if (spell?.kind !== "afflict" || isOver(game) || creature.readyAt > game.turn)
    return game;
  const turns = potencyOf(spell, creature.level);
  if (turns === 0) return game;
  const { affliction, cooldown } = spell;
  const { afflictions } = game.player;
  const until = Math.max(afflictions.get(affliction) ?? 0, game.turn + turns);
  return recorded(
    updated(
      withPlayer(game, {
        afflictions: new Map([...afflictions, [affliction, until]]),
      }),
      creature.id,
      { readyAt: game.turn + turns + cooldown },
    ),
    {
      kind: "afflicted",
      actor: whoIs(game, creature),
      target: THE_PLAYER,
      affliction,
      turns,
    },
  );
};

const struck = (game: Game, creature: Creature): Game =>
  afflicted(
    hurt(
      recorded(game, {
        kind: "hit",
        actor: whoIs(game, creature),
        target: THE_PLAYER,
      }),
      CREATURES[creature.kind].damage * creature.level,
    ),
    creature,
  );

/** Hurts `by`'s foe at `at`, if any; only the player hurts spawners. */
const hit = (game: Game, by: ActorId, at: Hex, damage: number): Game => {
  const target = occupantAt(game, at);
  if (target && areFoes(game, by, target))
    return target === PLAYER
      ? struck(game, creatureOf(game, by))
      : attackCreature(game, by, creatureOf(game, target), damage);
  const spawner = by === PLAYER ? spawnerAt(game, at) : undefined;
  if (spawner && spawnerOf(spawner.kind).faction === "wild")
    return attackSpawner(game, spawner, damage);
  return game;
};

const isInReach = ({ land }: Game, from: Hex, at: Hex): boolean =>
  canStep(land.tileAt, from, at);

const applied = (
  game: Game,
  effect: Effect,
  at: Hex | undefined,
  mastery: number,
): Game => {
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
        .reduce(
          (state, hex) => hit(state, PLAYER, hex, effect.amount * mastery),
          game,
        );
    case "restore": {
      const max = effect.stat === "hp" ? MAX_HP : MAX_MP;
      const amount = effect.amount * mastery;
      return withPlayer(game, {
        [effect.stat]: Math.min(max, player[effect.stat] + amount),
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
  if (aim.kind === "creature") {
    const target = at && creatureAt(game, at);
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
  if (masteryOf(game.player, id) === 0) return "unlearned";
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
  const mastery = masteryOf(game.player, action.ability);
  const used = recorded(spent(game, action.ability), {
    kind: "used",
    actor: THE_PLAYER,
    ability: action.ability,
  });
  return performed(
    effects.reduce(
      (state, effect) => applied(state, effect, action.at, mastery),
      used,
    ),
    spendsTurn,
  );
};

const learn: Rule<Learn> = (game, { spell }) => {
  const { player } = game;
  if (unlocksOf(player) === 0) return refused("no-unlocks");
  const level = spellLevelOf(player, spell) + 1;
  return performed(
    recorded(
      withPlayer(game, { spells: new Map([...player.spells, [spell, level]]) }),
      { kind: "learned", actor: THE_PLAYER, spell, level },
    ),
    false,
  );
};

const summon: Rule<Summon> = (game, _, actor) => {
  if (actor === PLAYER) return refused("unable");
  const caster = creatureOf(game, actor);
  const spell = CREATURE_SPELLS[caster.kind];
  if (spell?.kind !== "summon") return refused("unable");
  if (caster.readyAt > game.turn) return refused("not-ready");
  const sites = neighborsOf(caster.at)
    .filter(
      (next) =>
        canStep(game.land.tileAt, caster.at, next) && !isBlocked(game, next),
    )
    .slice(0, potencyOf(spell, caster.level));
  if (sites.length === 0) return refused("blocked");
  const summoned = sites.map((at, i) => ({
    ...spawnedFrom(game, caster.home, spell.creature, at),
    id: `${caster.id}/${game.turn}/${i}`,
    level: caster.level,
    mind: caster.mind,
  }));
  return performed(
    recorded(
      updated({ ...game, creatures: [...game.creatures, ...summoned] }, actor, {
        readyAt: game.turn + spell.cooldown,
      }),
      {
        kind: "summoned",
        actor: whoIs(game, caster),
        summoned: spell.creature,
        count: summoned.length,
      },
    ),
  );
};

const restock: Rule<Restock> = (game, _, actor) => {
  if (actor === PLAYER) return refused("unable");
  const trader = creatureOf(game, actor);
  const spell = CREATURE_SPELLS[trader.kind];
  if (spell?.kind !== "restock") return refused("unable");
  const { land, turn } = game;
  if (trader.readyAt > turn) return refused("not-ready");
  const missing = Math.max(0, spell.stock - trader.wares.length);
  if (missing === 0 && trader.purse >= spell.purse) return refused("full");
  const [min, max] = spell.cooldown;
  const cooldown = rngOf(land.seed, "restock").child(actor).int(min, max, turn);
  return performed(
    recorded(
      updated(game, actor, {
        wares: [...trader.wares, ...waresOf(land.seed, actor, turn, missing)],
        purse: Math.max(trader.purse, spell.purse),
        readyAt: turn + cooldown,
      }),
      { kind: "restocked", actor: whoIs(game, trader) },
    ),
  );
};

const stepToward = (
  game: Game,
  creature: Creature,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const route = findPath({
    start: creature.at,
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
  id: Creature["id"],
  change: Partial<Creature>,
): Game => ({
  ...game,
  creatures: game.creatures.map((m) => (m.id === id ? { ...m, ...change } : m)),
});

const withActor = (
  game: Game,
  actor: ActorId,
  change: Partial<Pick<Actor, "at" | "facing">>,
): Game =>
  actor === PLAYER ? withPlayer(game, change) : updated(game, actor, change);

interface Leash {
  readonly center: Hex;
  readonly radius: number;
}

const leashOf = ({ home, mind }: Creature): Leash => ({
  center: tetherOf(mind, home.at),
  radius: spawnerOf(home.kind).leash,
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
  creature: Creature,
  area: Leash,
  chance: number,
  heading?: Direction,
): Hex | undefined => {
  const { at, id } = creature;
  const rng = rngOf(game.land.seed, "wander").child(id);
  if (!rng.chance(chance, game.turn)) return undefined;
  const options = neighborsOf(at)
    .filter(
      (next) =>
        isWithin(next, area) &&
        isWithin(next, leashOf(creature)) &&
        canStep(game.land.tileAt, at, next) &&
        !isBlocked(game, next),
    )
    .map((next) => [next, alignment(at, next, heading)] as const);
  if (options.length === 0) return undefined;
  return rng.weighted(options, game.turn, 1);
};

const foesOf = (game: Game, creature: Creature): readonly Actor[] => {
  const faction = factionOfCreature(creature);
  return [
    ...(faction === "town" ? [] : [game.player]),
    ...game.creatures.filter((other) => factionOfCreature(other) !== faction),
  ];
};

/** Notices the nearest foe it can, else loses track. */
const mindOf = (game: Game, creature: Creature): Mind => {
  const { at, facing, mind } = creature;
  const distanceOf = (foe: Actor) => hexDistance(foe.at, at);
  const quarry = foesOf(game, creature)
    .filter(
      (foe) =>
        distanceOf(foe) <= SIGHT &&
        canNotice(game.land.tileAt, at, facing, foe.at),
    )
    .sort((a, b) => distanceOf(a) - distanceOf(b))[0];
  return quarry ? sighted(mind, at, quarry) : unsighted(mind, at);
};

const approach = (
  game: Game,
  creature: Creature,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const step = stepToward(game, creature, goal, reach);
  return step && isWithin(step, leashOf(creature)) ? step : undefined;
};

const destinationOf = (game: Game, creature: Creature): Hex | undefined => {
  const { mind, at, home } = creature;
  switch (mind.state) {
    case "idle": {
      const leash = leashOf(creature);
      return isWithin(at, leash)
        ? wander(game, creature, leash, WANDER_CHANCE)
        : stepToward(game, creature, home.at, leash.radius);
    }
    case "hostile":
      return approach(
        game,
        creature,
        mind.lastSeen,
        isBlocked(game, mind.lastSeen) ? 1 : 0,
      );
    case "hunting": {
      const area = { center: mind.lastSeen, radius: HUNT_RADIUS };
      return isWithin(at, area)
        ? wander(game, creature, area, 1, mind.heading)
        : approach(game, creature, mind.lastSeen, HUNT_RADIUS);
    }
  }
};

const toward = ({ at }: Creature, to: Hex | undefined): Intent => {
  const direction = to && directionBetween(at, to);
  return direction ? { kind: "move", direction } : { kind: "wait" };
};

const isBeside = ({ land }: Game, from: Hex, to: Hex): boolean =>
  directionBetween(from, to) !== undefined && canStep(land.tileAt, from, to);

/** Idle townsfolk beside the player stand still to deal with them. */
const isAttending = (game: Game, creature: Creature): boolean =>
  creature.mind.state === "idle" &&
  factionOfCreature(creature) === "town" &&
  isBeside(game, creature.at, game.player.at);

const choiceOf = (game: Game, creature: Creature): Intent => {
  const { mind } = creature;
  if (mind.state === "hostile" && isBeside(game, creature.at, mind.lastSeen))
    return toward(creature, mind.lastSeen);
  if (isAttending(game, creature)) return { kind: "wait" };
  return toward(creature, destinationOf(game, creature));
};

/** Its spell's Deed, when ready and in the state it's cast in. */
const castOf = (
  { kind, mind, readyAt }: Creature,
  { turn }: Game,
): Summon | Restock | undefined => {
  const spell = CREATURE_SPELLS[kind];
  if (!spell || readyAt > turn) return undefined;
  if (spell.kind === "summon" && mind.state === "hostile")
    return { kind: "summon" };
  if (spell.kind === "restock" && mind.state === "idle")
    return { kind: "restock" };
  return undefined;
};

const creaturePlanOf = (game: Game, creature: Creature): Plan => {
  const plan = planOf(game, creature.id, choiceOf(game, creature));
  const cast = castOf(creature, game);
  return cast
    ? { attempt: cast, otherwise: { blocked: plan, full: plan } }
    : plan;
};

const creatureTurn = (game: Game, creature: Creature): Game => {
  if (isOver(game)) return game;
  const aware = { ...creature, mind: mindOf(game, creature) };
  const minded = updated(game, aware.id, { mind: aware.mind });
  return settled(minded, aware.id, creaturePlanOf(minded, aware)).game;
};

const creaturesTurn = (game: Game): Game =>
  game.creatures.reduce(
    (state, { id }) => creatureTurn(state, creatureOf(state, id)),
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

const bleed = (game: Game): Game =>
  isOver(game) || afflictionOf(game, "bleed") === 0
    ? game
    : hurt(recorded(game, { kind: "bled", actor: THE_PLAYER }), 1);

const endTurn = (acted: Game): Game =>
  withSight(
    populate(
      regenerate(bleed(creaturesTurn({ ...acted, turn: acted.turn + 1 }))),
    ),
  );

const turn: Rule<Turn> = (game, { direction }, actor) => {
  if (actorOf(game, actor).facing === direction)
    return refused("already-facing");
  if (isAfflicted(game, actor, "paralysis")) return refused("paralyzed");
  return performed(
    recorded(withActor(game, actor, { facing: direction }), {
      kind: "turned",
      actor: whoOf(game, actor),
      facing: direction,
    }),
  );
};

const step: Rule<Step> = (game, { direction }, actor) => {
  const { at, facing } = actorOf(game, actor);
  if (facing !== direction) return refused("not-facing");
  const to = add(at, DIRECTIONS[direction]);
  if (!canStep(game.land.tileAt, at, to)) return refused("blocked");
  if (isBlocked(game, to)) return refused("occupied");
  if (isAfflicted(game, actor, "paralysis")) return refused("paralyzed");
  return performed(
    recorded(withActor(game, actor, { at: to }), {
      kind: "stepped",
      actor: whoOf(game, actor),
      direction,
      to,
    }),
  );
};

const foeProblemOf = (
  game: Game,
  actor: ActorId,
  at: Hex,
): Rejection | undefined => {
  const occupant = occupantAt(game, at);
  if (occupant) return areFoes(game, actor, occupant) ? undefined : "friendly";
  const spawner = actor === PLAYER ? spawnerAt(game, at) : undefined;
  if (!spawner) return "no-target";
  return spawnerOf(spawner.kind).faction === "wild" ? undefined : "friendly";
};

const damageOf = (game: Game, actor: ActorId): number => {
  if (actor === PLAYER) return PLAYER_DAMAGE;
  const { kind, level } = creatureOf(game, actor);
  return CREATURES[kind].damage * level;
};

const attack: Rule<Attack> = (game, { at }, actor) => {
  const foeProblem = foeProblemOf(game, actor, at);
  if (foeProblem) return refused(foeProblem);
  const { at: from, facing } = actorOf(game, actor);
  const problem = reachProblemOf(game, from, at);
  if (problem) return refused(problem);
  if (directionBetween(from, at) !== facing) return refused("not-facing");
  return performed(hit(game, actor, at, damageOf(game, actor)));
};

const interact: Rule<Interact> = (game, { at }, actor) => {
  if (actor !== PLAYER) return refused("unable");
  if (!at) return refused("no-target");
  const problem = reachProblemOf(game, game.player.at, at);
  if (problem) return refused(problem);
  const npc = creatureAt(game, at);
  if (!npc) return refused("no-target");
  const service = SERVICES[npc.kind];
  if (!service) return refused("uninterested");
  const met = recorded(game, {
    kind: "interacted",
    actor: THE_PLAYER,
    target: whoIs(game, npc),
  });
  return performed(service === "bounty" ? bountied(met, npc) : met);
};

const rewarded = (game: Game, bounty: Bounty, bailiff: Creature): Game => {
  const gold = BOUNTY_GOLD_PER_LEVEL * bounty.level;
  return recorded(
    withPlayer(game, {
      gold: game.player.gold + gold,
      bounty: undefined,
      bountyLevel: bounty.level,
    }),
    {
      kind: "rewarded",
      actor: whoIs(game, bailiff),
      target: THE_PLAYER,
      gold,
    },
  );
};

/** The nearest lair to `from` above `level`, searched in widening rings. */
const lairAbove = (game: Game, from: Hex, level: number) => {
  const { land } = game;
  for (const radius of BOUNTY_SEARCH) {
    const lair = land
      .spawnersIn(boundsAround(from, radius))
      .filter(
        ({ kind, at }) =>
          spawnerOf(kind).faction === "wild" &&
          dangerOf(at, land.spawn) > level &&
          hexDistance(at, from) <= radius,
      )
      .sort((a, b) => hexDistance(a.at, from) - hexDistance(b.at, from))[0];
    if (lair) return lair;
  }
  return undefined;
};

/** Pays a slain bounty, then posts the next if none is outstanding. */
const bountied = (game: Game, bailiff: Creature): Game => {
  const { bounty } = game.player;
  if (bounty && !bounty.isSlain) return game;
  const paid = bounty ? rewarded(game, bounty, bailiff) : game;
  const lair = lairAbove(paid, bailiff.at, paid.player.bountyLevel);
  if (!lair) return paid;
  const level = dangerOf(lair.at, game.land.spawn);
  return recorded(
    withPlayer(paid, {
      bounty: { kind: lair.kind, at: lair.at, level, isSlain: false },
    }),
    {
      kind: "bountied",
      actor: whoIs(game, bailiff),
      target: THE_PLAYER,
      spawner: lair.kind,
      at: lair.at,
      level,
    },
  );
};

const traderOf = (game: Game, id: Creature["id"]): Creature | undefined =>
  game.creatures.find(
    (creature) => creature.id === id && SERVICES[creature.kind] === "trade",
  );

const sell = (game: Game, trader: Creature, item: Item): Outcome => {
  const price = offerOf(item);
  if (trader.purse < price) return refused("no-gold");
  const { pack, gold } = game.player;
  return performed(
    recorded(
      updated(
        withPlayer(game, {
          pack: pack.filter((held) => held !== item),
          gold: gold + price,
        }),
        trader.id,
        { wares: [...trader.wares, item], purse: trader.purse - price },
      ),
      {
        kind: "sold",
        actor: THE_PLAYER,
        target: whoIs(game, trader),
        item,
        price,
      },
    ),
  );
};

const buy = (game: Game, trader: Creature, item: Item): Outcome => {
  const price = priceOf(item);
  const { pack, gold, equipment } = game.player;
  if (gold < price) return refused("no-gold");
  if (loadOf(pack) + sizeOf(item) > capacityOf(equipment))
    return refused("full");
  return performed(
    recorded(
      updated(
        withPlayer(game, { pack: [...pack, item], gold: gold - price }),
        trader.id,
        {
          wares: trader.wares.filter((ware) => ware !== item),
          purse: trader.purse + price,
        },
      ),
      {
        kind: "bought",
        actor: THE_PLAYER,
        target: whoIs(game, trader),
        item,
        price,
      },
    ),
  );
};

const trade: Rule<Trade> = (game, action, actor) => {
  if (actor !== PLAYER) return refused("unable");
  const trader = traderOf(game, action.trader);
  if (!trader) return refused("no-target");
  const problem = reachProblemOf(game, game.player.at, trader.at);
  if (problem) return refused(problem);
  const isIt = ({ id }: Item) => id === action.item;
  const sold = game.player.pack.find(isIt);
  if (sold) return sell(game, trader, sold);
  const bought = trader.wares.find(isIt);
  return bought ? buy(game, trader, bought) : refused("no-item");
};

const RULES: {
  readonly [K in Deed["kind"]]: Rule<Extract<Deed, { kind: K }>>;
} = {
  turn,
  step,
  attack,
  wait: (game) => performed(game),
  use,
  transfer,
  "take-all": takeAll,
  prepare: (game) =>
    performed(recorded(game, { kind: "prepared", actor: THE_PLAYER })),
  destroy,
  learn,
  summon,
  restock,
  interact,
  trade,
};

interface Settlement {
  readonly game: Game;
  readonly spendsTurn: boolean;
}

const outcomeOf = <A extends Deed>(
  game: Game,
  action: A,
  actor: ActorId,
): Outcome => (RULES[action.kind] as Rule<A>)(game, action, actor);

/** Step the way faced, else turn that way, else `bump` whoever is in the way. */
const moving = (direction: Direction, bump: Plan): Plan => ({
  attempt: { kind: "step", direction },
  otherwise: {
    "not-facing": { attempt: { kind: "turn", direction } },
    occupied: bump,
  },
});

const bold = (ahead: Hex): Plan => ({ attempt: { kind: "attack", at: ahead } });

/** Bold toward foes; interacts with friends. */
const courteous = (ahead: Hex): Plan => ({
  attempt: { kind: "attack", at: ahead },
  otherwise: { friendly: { attempt: { kind: "interact", at: ahead } } },
});

const planOf = (game: Game, actor: ActorId, intent: Intent): Plan => {
  if (intent.kind !== "move") return { attempt: intent };
  const ahead = add(actorOf(game, actor).at, DIRECTIONS[intent.direction]);
  const policy = actor === PLAYER ? courteous : bold;
  return moving(intent.direction, policy(ahead));
};

interface Attempt {
  readonly deed: Deed;
  readonly outcome: Outcome;
}

const attempted = (
  game: Game,
  actor: ActorId,
  { attempt, otherwise }: Plan,
): Attempt => {
  const outcome = outcomeOf(game, attempt, actor);
  const next =
    outcome.kind === "rejected" ? otherwise?.[outcome.reason] : undefined;
  return next ? attempted(game, actor, next) : { deed: attempt, outcome };
};

const settled = (game: Game, actor: ActorId, plan: Plan): Settlement => {
  const { deed, outcome } = attempted(game, actor, plan);
  if (outcome.kind === "performed") return outcome;
  return {
    game: rejected(game, actor, deed, outcome.reason),
    spendsTurn: false,
  };
};

const resolve = (game: Game, intent: Intent): Game => {
  const plan = planOf(game, PLAYER, intent);
  const { game: next, spendsTurn } = settled(game, PLAYER, plan);
  return spendsTurn ? endTurn(next) : next;
};

const incapacityOf = (game: Game, intent: Intent): Rejection | undefined => {
  if (isOver(game)) return "over";
  if (intent.kind !== "wait" && isAfflicted(game, PLAYER, "stun"))
    return "stunned";
  return undefined;
};

export const act = (game: Game, intent: Intent): Game => {
  const fresh = { ...game, events: [] };
  const incapacity = incapacityOf(fresh, intent);
  return incapacity
    ? rejected(fresh, PLAYER, intent, incapacity)
    : resolve(fresh, intent);
};
