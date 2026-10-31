export const MONSTERS = {
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
} as const;

export type MonsterKind = keyof typeof MONSTERS;

export interface SpawnerType {
  readonly name: string;
  readonly pool: readonly (readonly [MonsterKind, number])[];
  readonly boss: MonsterKind;
  readonly cap: number;
  readonly leash: number;
  readonly interval: number;
  readonly chance: number;
}

export const SPAWNERS = {
  den: {
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
    name: "goblin village",
    pool: [["goblin", 1]],
    boss: "goblin chief",
    cap: 4,
    leash: 6,
    interval: 15,
    chance: 0.2,
  },
  mine: {
    name: "kobold mine",
    pool: [["kobold", 1]],
    boss: "kobold foreman",
    cap: 5,
    leash: 4,
    interval: 10,
    chance: 0.25,
  },
  cave: {
    name: "troll cave",
    pool: [["troll", 1]],
    boss: "troll elder",
    cap: 1,
    leash: 4,
    interval: 40,
    chance: 0.1,
  },
} as const satisfies Record<string, SpawnerType>;

export type SpawnerKind = keyof typeof SPAWNERS;

const SPAWNER_HP_PER_MONSTER_HP = 3;

export const spawnerHpOf = (kind: SpawnerKind): number =>
  SPAWNER_HP_PER_MONSTER_HP *
  Math.max(...SPAWNERS[kind].pool.map(([monster]) => MONSTERS[monster].hp));
