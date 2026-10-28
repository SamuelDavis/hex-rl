export const MONSTERS = {
  wolf: {
    glyph: "w",
    hue: 30,
    hp: 3,
    damage: 1,
    gold: { chance: 0.2, min: 1, max: 2 },
  },
  cub: {
    glyph: "c",
    hue: 35,
    hp: 1,
    damage: 1,
    gold: { chance: 0.1, min: 1, max: 1 },
  },
  bandit: {
    glyph: "b",
    hue: 0,
    hp: 4,
    damage: 2,
    gold: { chance: 0.8, min: 3, max: 10 },
  },
  thief: {
    glyph: "t",
    hue: 320,
    hp: 2,
    damage: 1,
    gold: { chance: 0.9, min: 2, max: 8 },
  },
  kobold: {
    glyph: "k",
    hue: 60,
    hp: 2,
    damage: 1,
    gold: { chance: 0.5, min: 1, max: 4 },
  },
  goblin: {
    glyph: "g",
    hue: 90,
    hp: 4,
    damage: 2,
    gold: { chance: 0.5, min: 2, max: 6 },
  },
  troll: {
    glyph: "T",
    hue: 280,
    hp: 8,
    damage: 3,
    gold: { chance: 1, min: 10, max: 25 },
  },
  "alpha wolf": {
    glyph: "W",
    hue: 20,
    hp: 8,
    damage: 2,
    gold: { chance: 1, min: 5, max: 12 },
  },
  "bandit chief": {
    glyph: "B",
    hue: 350,
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 20, max: 40 },
  },
  "goblin chief": {
    glyph: "G",
    hue: 100,
    hp: 10,
    damage: 3,
    gold: { chance: 1, min: 15, max: 30 },
  },
  "kobold foreman": {
    glyph: "K",
    hue: 50,
    hp: 6,
    damage: 2,
    gold: { chance: 1, min: 10, max: 20 },
  },
  "troll elder": {
    glyph: "E",
    hue: 270,
    hp: 16,
    damage: 4,
    gold: { chance: 1, min: 40, max: 80 },
  },
} as const;

export type MonsterKind = keyof typeof MONSTERS;

export interface SpawnerType {
  readonly name: string;
  readonly hue: number;
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
    hue: 30,
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
    hue: 0,
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
    hue: 90,
    pool: [["goblin", 1]],
    boss: "goblin chief",
    cap: 4,
    leash: 6,
    interval: 15,
    chance: 0.2,
  },
  mine: {
    name: "kobold mine",
    hue: 60,
    pool: [["kobold", 1]],
    boss: "kobold foreman",
    cap: 5,
    leash: 4,
    interval: 10,
    chance: 0.25,
  },
  cave: {
    name: "troll cave",
    hue: 280,
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
