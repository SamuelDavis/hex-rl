import type { AbilityId } from "./abilities";
import type { FactionId } from "./factions";

export const CREATURES = {
  wolf: {
    hp: 3,
    damage: 1,
    gold: { chance: 0.2, min: 1, max: 2 },
    items: { chance: 0.1, rolls: 1 },
  },
  cub: {
    hp: 1,
    damage: 1,
    gold: { chance: 0.1, min: 1, max: 1 },
    items: { chance: 0.05, rolls: 1 },
  },
  bandit: {
    hp: 4,
    damage: 2,
    gold: { chance: 0.8, min: 3, max: 10 },
    items: { chance: 0.4, rolls: 2 },
  },
  thief: {
    hp: 2,
    damage: 1,
    gold: { chance: 0.9, min: 2, max: 8 },
    items: { chance: 0.4, rolls: 2 },
  },
  kobold: {
    hp: 2,
    damage: 1,
    gold: { chance: 0.5, min: 1, max: 4 },
    items: { chance: 0.25, rolls: 1 },
  },
  goblin: {
    hp: 4,
    damage: 2,
    gold: { chance: 0.5, min: 2, max: 6 },
    items: { chance: 0.3, rolls: 2 },
  },
  troll: {
    hp: 8,
    damage: 3,
    gold: { chance: 1, min: 10, max: 25 },
    items: { chance: 0.5, rolls: 3 },
  },
  "alpha wolf": {
    hp: 8,
    damage: 2,
    gold: { chance: 1, min: 5, max: 12 },
    items: { chance: 0.8, rolls: 2 },
  },
  "bandit chief": {
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 20, max: 40 },
    items: { chance: 0.8, rolls: 3 },
  },
  "goblin chief": {
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 15, max: 30 },
    items: { chance: 0.8, rolls: 3 },
  },
  "kobold foreman": {
    hp: 6,
    damage: 2,
    gold: { chance: 1, min: 10, max: 20 },
    items: { chance: 0.8, rolls: 2 },
  },
  "troll elder": {
    hp: 16,
    damage: 4,
    gold: { chance: 1, min: 40, max: 80 },
    items: { chance: 0.9, rolls: 4 },
  },
  bailiff: {
    hp: 12,
    damage: 3,
    gold: { chance: 1, min: 5, max: 15 },
    items: { chance: 0.3, rolls: 1 },
  },
  reeve: {
    hp: 6,
    damage: 1,
    gold: { chance: 1, min: 10, max: 30 },
    items: { chance: 0.5, rolls: 2 },
  },
  peasant: {
    hp: 4,
    damage: 1,
    gold: { chance: 0.3, min: 1, max: 3 },
    items: { chance: 0.05, rolls: 1 },
  },
  baron: {
    hp: 18,
    damage: 4,
    gold: { chance: 1, min: 30, max: 60 },
    items: { chance: 0.6, rolls: 2 },
  },
  duke: {
    hp: 24,
    damage: 5,
    gold: { chance: 1, min: 60, max: 120 },
    items: { chance: 0.8, rolls: 3 },
  },
  miner: {
    hp: 5,
    damage: 2,
    gold: { chance: 0.6, min: 2, max: 6 },
    items: { chance: 0.05, rolls: 1 },
  },
  "mine captain": {
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 10, max: 25 },
    items: { chance: 0.3, rolls: 1 },
  },
  carpenter: {
    hp: 5,
    damage: 2,
    gold: { chance: 0.3, min: 1, max: 4 },
    items: { chance: 0.1, rolls: 1 },
  },
  "master carpenter": {
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 8, max: 20 },
    items: { chance: 0.3, rolls: 1 },
  },
  footman: {
    hp: 7,
    damage: 2,
    gold: { chance: 0.4, min: 2, max: 5 },
    items: { chance: 0.2, rolls: 1 },
  },
  sergeant: {
    hp: 12,
    damage: 3,
    gold: { chance: 1, min: 8, max: 20 },
    items: { chance: 0.4, rolls: 2 },
  },
  blacksmith: {
    hp: 6,
    damage: 2,
    gold: { chance: 0.4, min: 2, max: 6 },
    items: { chance: 0.3, rolls: 1 },
  },
  "master smith": {
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 10, max: 25 },
    items: { chance: 0.6, rolls: 2 },
  },
  knight: {
    hp: 12,
    damage: 3,
    gold: { chance: 0.8, min: 5, max: 15 },
    items: { chance: 0.4, rolls: 2 },
  },
  marshal: {
    hp: 16,
    damage: 4,
    gold: { chance: 1, min: 15, max: 35 },
    items: { chance: 0.6, rolls: 2 },
  },
  farmer: {
    hp: 4,
    damage: 1,
    gold: { chance: 0.3, min: 1, max: 3 },
    items: { chance: 0.05, rolls: 1 },
  },
  yeoman: {
    hp: 8,
    damage: 2,
    gold: { chance: 1, min: 5, max: 12 },
    items: { chance: 0.2, rolls: 1 },
  },
  fisher: {
    hp: 4,
    damage: 1,
    gold: { chance: 0.3, min: 1, max: 4 },
    items: { chance: 0.05, rolls: 1 },
  },
  harbourmaster: {
    hp: 8,
    damage: 2,
    gold: { chance: 1, min: 10, max: 25 },
    items: { chance: 0.3, rolls: 1 },
  },
  merchant: {
    hp: 4,
    damage: 1,
    gold: { chance: 1, min: 5, max: 15 },
    items: { chance: 0.3, rolls: 1 },
  },
  "caravan master": {
    hp: 8,
    damage: 2,
    gold: { chance: 1, min: 20, max: 40 },
    items: { chance: 0.5, rolls: 2 },
  },
} as const;

export type CreatureKind = keyof typeof CREATURES;

const SUMMONS_CUBS: readonly AbilityId[] = ["summon cubs"];
const BLEEDS: readonly AbilityId[] = ["bleed"];
const PARALYZES: readonly AbilityId[] = ["paralyze"];
const STUNS: readonly AbilityId[] = ["stun"];

/** Abilities each kind knows, at its level. */
export const KNACKS: Partial<Record<CreatureKind, readonly AbilityId[]>> = {
  wolf: SUMMONS_CUBS,
  "alpha wolf": SUMMONS_CUBS,
  bandit: BLEEDS,
  "bandit chief": BLEEDS,
  goblin: PARALYZES,
  "goblin chief": PARALYZES,
  troll: STUNS,
  "troll elder": STUNS,
  reeve: ["restock"],
};

export type Service = "trade" | "bounty";

/** What the player gets by interacting with a creature; creatures without one are uninterested. */
export const SERVICES: Partial<Record<CreatureKind, Service>> = {
  bailiff: "bounty",
  reeve: "trade",
};

type Weighted = readonly (readonly [CreatureKind, number])[];

/** How a spawner chooses its next recruit: weighted draws from `pool` while fewer than `cap` are alive, or the first `roster` kind with fewer than its count alive. */
export type Recruiting =
  | { readonly kind: "pool"; readonly pool: Weighted; readonly cap: number }
  | { readonly kind: "roster"; readonly roster: Weighted };

/** When its boss appears: once the spawner is wrecked, or `always`, kept alive before any recruit. At most one is alive at once. */
export interface Boss {
  readonly kind: CreatureKind;
  readonly spawns: "wrecked" | "always";
}

/** A spawner's strategy: its recruiting and its boss, at most one recruit per `interval` turns, each turn at `chance`. */
export interface SpawnerType {
  readonly faction: FactionId;
  readonly name: string;
  readonly boss: Boss;
  readonly recruits: Recruiting;
  readonly leash: number;
  readonly interval: number;
  readonly chance: number;
}

export const SPAWNERS = {
  den: {
    faction: "wild",
    name: "wolf den",
    boss: { kind: "alpha wolf", spawns: "wrecked" },
    recruits: {
      kind: "pool",
      pool: [
        ["wolf", 3],
        ["cub", 2],
      ],
      cap: 4,
    },
    leash: 8,
    interval: 15,
    chance: 0.2,
  },
  camp: {
    faction: "wild",
    name: "bandit camp",
    boss: { kind: "bandit chief", spawns: "wrecked" },
    recruits: {
      kind: "pool",
      pool: [
        ["bandit", 3],
        ["thief", 1],
      ],
      cap: 3,
    },
    leash: 6,
    interval: 20,
    chance: 0.15,
  },
  village: {
    faction: "wild",
    name: "goblin village",
    boss: { kind: "goblin chief", spawns: "wrecked" },
    recruits: { kind: "pool", pool: [["goblin", 1]], cap: 4 },
    leash: 6,
    interval: 15,
    chance: 0.2,
  },
  mine: {
    faction: "wild",
    name: "kobold mine",
    boss: { kind: "kobold foreman", spawns: "wrecked" },
    recruits: { kind: "pool", pool: [["kobold", 1]], cap: 5 },
    leash: 4,
    interval: 10,
    chance: 0.25,
  },
  cave: {
    faction: "wild",
    name: "troll cave",
    boss: { kind: "troll elder", spawns: "wrecked" },
    recruits: { kind: "pool", pool: [["troll", 1]], cap: 1 },
    leash: 4,
    interval: 40,
    chance: 0.1,
  },
  town: {
    faction: "town",
    name: "town",
    boss: { kind: "bailiff", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [
        ["reeve", 1],
        ["peasant", 3],
      ],
    },
    leash: 6,
    interval: 10,
    chance: 0.5,
  },
  keep: {
    faction: "town",
    name: "keep",
    boss: { kind: "baron", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [
        ["bailiff", 1],
        ["reeve", 1],
        ["peasant", 3],
      ],
    },
    leash: 8,
    interval: 10,
    chance: 0.5,
  },
  castle: {
    faction: "town",
    name: "castle",
    boss: { kind: "duke", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [
        ["baron", 1],
        ["bailiff", 1],
        ["reeve", 1],
        ["peasant", 3],
      ],
    },
    leash: 10,
    interval: 10,
    chance: 0.5,
  },
  "gold mine": {
    faction: "town",
    name: "gold mine",
    boss: { kind: "mine captain", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["miner", 3]],
    },
    leash: 4,
    interval: 10,
    chance: 0.5,
  },
  sawmill: {
    faction: "town",
    name: "sawmill",
    boss: { kind: "master carpenter", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["carpenter", 2]],
    },
    leash: 4,
    interval: 10,
    chance: 0.5,
  },
  barracks: {
    faction: "town",
    name: "barracks",
    boss: { kind: "sergeant", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["footman", 3]],
    },
    leash: 6,
    interval: 10,
    chance: 0.5,
  },
  smithy: {
    faction: "town",
    name: "smithy",
    boss: { kind: "master smith", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["blacksmith", 2]],
    },
    leash: 4,
    interval: 10,
    chance: 0.5,
  },
  stables: {
    faction: "town",
    name: "stables",
    boss: { kind: "marshal", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["knight", 2]],
    },
    leash: 8,
    interval: 10,
    chance: 0.5,
  },
  farm: {
    faction: "town",
    name: "farm",
    boss: { kind: "yeoman", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["farmer", 3]],
    },
    leash: 4,
    interval: 10,
    chance: 0.5,
  },
  docks: {
    faction: "town",
    name: "docks",
    boss: { kind: "harbourmaster", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["fisher", 3]],
    },
    leash: 4,
    interval: 10,
    chance: 0.5,
  },
  bazaar: {
    faction: "town",
    name: "bazaar",
    boss: { kind: "caravan master", spawns: "always" },
    recruits: {
      kind: "roster",
      roster: [["merchant", 3]],
    },
    leash: 4,
    interval: 10,
    chance: 0.5,
  },
} as const satisfies Record<string, SpawnerType>;

export type SpawnerKind = keyof typeof SPAWNERS;

export const spawnerOf = (kind: SpawnerKind): SpawnerType => SPAWNERS[kind];

export const bossOf = (kind: SpawnerKind): CreatureKind =>
  spawnerOf(kind).boss.kind;

const recruitsOf = ({ recruits }: SpawnerType): Weighted =>
  recruits.kind === "pool" ? recruits.pool : recruits.roster;

/** The kinds it keeps alive: its recruits, and its boss when it is `always` kept. */
export const membersOf = (kind: SpawnerKind): readonly CreatureKind[] => {
  const type = spawnerOf(kind);
  const recruits = recruitsOf(type).map(([creature]) => creature);
  return type.boss.spawns === "always"
    ? [type.boss.kind, ...recruits]
    : recruits;
};

const SPAWNER_HP_PER_MONSTER_HP = 3;

export const spawnerHpOf = (kind: SpawnerKind): number =>
  SPAWNER_HP_PER_MONSTER_HP *
  Math.max(...membersOf(kind).map((creature) => CREATURES[creature].hp));
