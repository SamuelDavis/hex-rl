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
} as const;

export type CreatureKind = keyof typeof CREATURES;

/** Creatures of different factions fight; the player is `town`. */
export type Faction = "wild" | "town";

export type Affliction = "bleed" | "stun" | "paralysis";

/** `perLevel` scales potency (cubs summoned, turns afflicted) linearly with the caster's level, rounded down. */
export type CreatureSpell =
  | {
      /** Refills wares to `stock` items and its purse to `purse` gold while idle. */
      readonly kind: "restock";
      readonly stock: number;
      readonly purse: number;
      /** Turns after restocking before it can restock again, drawn from this range. */
      readonly cooldown: readonly [min: number, max: number];
    }
  | {
      readonly kind: "summon";
      readonly creature: CreatureKind;
      readonly perLevel: number;
      /** Turns after casting before it can be cast again. */
      readonly cooldown: number;
    }
  | {
      readonly kind: "afflict";
      readonly affliction: Affliction;
      readonly perLevel: number;
      /** Turns after the affliction wears off before it can be inflicted again. */
      readonly cooldown: number;
    };

const SUMMON_CUBS: CreatureSpell = {
  kind: "summon",
  creature: "cub",
  perLevel: 1,
  cooldown: 15,
};
const BLEED: CreatureSpell = {
  kind: "afflict",
  affliction: "bleed",
  perLevel: 1,
  cooldown: 3,
};
const STUN: CreatureSpell = {
  kind: "afflict",
  affliction: "stun",
  perLevel: 0.5,
  cooldown: 4,
};
const PARALYZE: CreatureSpell = {
  kind: "afflict",
  affliction: "paralysis",
  perLevel: 1,
  cooldown: 4,
};

/** Summons are cast while hostile, restocks while idle; afflictions ride on a landed attack. */
export const CREATURE_SPELLS: Partial<Record<CreatureKind, CreatureSpell>> = {
  wolf: SUMMON_CUBS,
  "alpha wolf": SUMMON_CUBS,
  bandit: BLEED,
  "bandit chief": BLEED,
  goblin: PARALYZE,
  "goblin chief": PARALYZE,
  troll: STUN,
  "troll elder": STUN,
  reeve: { kind: "restock", stock: 6, purse: 60, cooldown: [100, 200] },
};

export type Service = "trade" | "bounty";

/** What the player gets by interacting with a creature; creatures without one are uninterested. */
export const SERVICES: Partial<Record<CreatureKind, Service>> = {
  bailiff: "bounty",
  reeve: "trade",
};

export const potencyOf = (
  { perLevel }: { readonly perLevel: number },
  level: number,
): number => Math.floor(perLevel * level);

interface Spawning {
  readonly name: string;
  readonly leash: number;
  readonly interval: number;
  readonly chance: number;
}

/** Spawns weighted draws from `pool` up to `cap`; wrecked, it unleashes `boss`. */
export interface Lair extends Spawning {
  readonly faction: "wild";
  readonly pool: readonly (readonly [CreatureKind, number])[];
  readonly boss: CreatureKind;
  readonly cap: number;
}

/** Spawns the first `roster` kind with fewer than its count alive. */
export interface Town extends Spawning {
  readonly faction: "town";
  readonly roster: readonly (readonly [CreatureKind, number])[];
}

export type SpawnerType = Lair | Town;

export const SPAWNERS = {
  den: {
    faction: "wild",
    name: "wolf den",
    pool: [
      ["wolf", 3],
      ["cub", 2],
    ],
    boss: "alpha wolf",
    cap: 4,
    leash: 8,
    interval: 15,
    chance: 0.2,
  },
  camp: {
    faction: "wild",
    name: "bandit camp",
    pool: [
      ["bandit", 3],
      ["thief", 1],
    ],
    boss: "bandit chief",
    cap: 3,
    leash: 6,
    interval: 20,
    chance: 0.15,
  },
  village: {
    faction: "wild",
    name: "goblin village",
    pool: [["goblin", 1]],
    boss: "goblin chief",
    cap: 4,
    leash: 6,
    interval: 15,
    chance: 0.2,
  },
  mine: {
    faction: "wild",
    name: "kobold mine",
    pool: [["kobold", 1]],
    boss: "kobold foreman",
    cap: 5,
    leash: 4,
    interval: 10,
    chance: 0.25,
  },
  cave: {
    faction: "wild",
    name: "troll cave",
    pool: [["troll", 1]],
    boss: "troll elder",
    cap: 1,
    leash: 4,
    interval: 40,
    chance: 0.1,
  },
  town: {
    faction: "town",
    name: "town",
    roster: [
      ["bailiff", 1],
      ["reeve", 1],
      ["peasant", 3],
    ],
    leash: 6,
    interval: 10,
    chance: 0.5,
  },
} as const satisfies Record<string, SpawnerType>;

export type SpawnerKind = keyof typeof SPAWNERS;

export const spawnerOf = (kind: SpawnerKind): SpawnerType => SPAWNERS[kind];

export const bossOf = (kind: SpawnerKind): CreatureKind | undefined => {
  const type = spawnerOf(kind);
  return type.faction === "wild" ? type.boss : undefined;
};

export const membersOf = (kind: SpawnerKind): readonly CreatureKind[] => {
  const type = spawnerOf(kind);
  const entries = type.faction === "wild" ? type.pool : type.roster;
  return entries.map(([creature]) => creature);
};

const SPAWNER_HP_PER_MONSTER_HP = 3;

export const spawnerHpOf = (kind: SpawnerKind): number =>
  SPAWNER_HP_PER_MONSTER_HP *
  Math.max(...membersOf(kind).map((creature) => CREATURES[creature].hp));
