import {
  add,
  DIRECTIONS,
  flanksOf,
  neighborsOf,
  type Direction,
  type Hex,
} from "./hex";
import type { PotionKind } from "./items";

export type Aim =
  | { readonly kind: "none" }
  | { readonly kind: "monster" }
  | { readonly kind: "hex"; readonly range: number };

export type Area = "target" | "ahead" | "flanks" | "ring";

export type Effect =
  | { readonly kind: "face" }
  | { readonly kind: "damage"; readonly area: Area; readonly amount: number }
  | {
      readonly kind: "restore";
      readonly stat: "hp" | "mp";
      readonly amount: number;
    };

export interface Ability {
  readonly mp: number;
  /** Turns after use before it can be used again. */
  readonly cooldown: number;
  readonly spendsTurn: boolean;
  readonly consumes?: PotionKind;
  readonly aim: Aim;
  readonly effects: readonly Effect[];
  readonly summary: string;
}

export const PLAYER_DAMAGE = 2;
export const CLEAVE_SPLASH = 0.5;
export const FIREBALL_DAMAGE = 4;
export const FIREBALL_SPLASH = 0.25;
export const HEAL_HP = 5;
export const HEALTH_POTION_HP = 8;
export const MANA_POTION_MP = 5;

const splashed = (damage: number, fraction: number) =>
  Math.ceil(damage * fraction);

const NO_AIM: Aim = { kind: "none" };

const potion = (
  kind: PotionKind,
  stat: "hp" | "mp",
  amount: number,
): Ability => ({
  mp: 0,
  cooldown: 0,
  spendsTurn: false,
  consumes: kind,
  aim: NO_AIM,
  effects: [{ kind: "restore", stat, amount }],
  summary: `Restore ${amount} ${stat.toUpperCase()}.`,
});

export const ABILITIES = {
  cleave: {
    mp: 3,
    cooldown: 1,
    spendsTurn: true,
    aim: NO_AIM,
    effects: [
      { kind: "damage", area: "ahead", amount: PLAYER_DAMAGE },
      {
        kind: "damage",
        area: "flanks",
        amount: splashed(PLAYER_DAMAGE, CLEAVE_SPLASH),
      },
    ],
    summary: "Attack ahead, and half as hard to either side.",
  },
  fireball: {
    mp: 7,
    cooldown: 5,
    spendsTurn: true,
    aim: { kind: "hex", range: 3 },
    effects: [
      { kind: "damage", area: "target", amount: FIREBALL_DAMAGE },
      {
        kind: "damage",
        area: "ring",
        amount: splashed(FIREBALL_DAMAGE, FIREBALL_SPLASH),
      },
    ],
    summary: "Burn a hex in sight, and a quarter as hard around it.",
  },
  heal: {
    mp: 5,
    cooldown: 3,
    spendsTurn: true,
    aim: NO_AIM,
    effects: [{ kind: "restore", stat: "hp", amount: HEAL_HP }],
    summary: `Restore ${HEAL_HP} HP.`,
  },
  strike: {
    mp: 2,
    cooldown: 1,
    spendsTurn: true,
    aim: { kind: "monster" },
    effects: [
      { kind: "face" },
      { kind: "damage", area: "target", amount: PLAYER_DAMAGE },
    ],
    summary: "Face the adjacent target and attack it.",
  },
  health: potion("health", "hp", HEALTH_POTION_HP),
  mana: potion("mana", "mp", MANA_POTION_MP),
} as const satisfies Record<string, Ability>;

export type AbilityId = keyof typeof ABILITIES;

export const ABILITY_IDS = Object.keys(ABILITIES) as readonly AbilityId[];

export const isAbility = (value: unknown): value is AbilityId =>
  typeof value === "string" && value in ABILITIES;

export const abilityOf = (id: AbilityId): Ability => ABILITIES[id];

export const MELEE_AREAS: ReadonlySet<Area> = new Set(["ahead", "flanks"]);

export const areaOf = (
  area: Area,
  from: Hex,
  facing: Direction,
  at: Hex | undefined,
): readonly Hex[] => {
  const toward = (direction: Direction) => add(from, DIRECTIONS[direction]);
  switch (area) {
    case "target":
      return at ? [at] : [];
    case "ahead":
      return [toward(facing)];
    case "flanks":
      return flanksOf(facing).map(toward);
    case "ring":
      return at ? neighborsOf(at) : [];
  }
};
