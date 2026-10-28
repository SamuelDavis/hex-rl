import { neighborsOf, type Hex } from "./hex";

export type Aim =
  | { readonly kind: "none" }
  | { readonly kind: "monster" }
  | { readonly kind: "hex"; readonly range: number };

export interface Spell {
  readonly mp: number;
  /** Turns after casting before it can be cast again. */
  readonly cooldown: number;
  readonly aim: Aim;
  readonly summary: string;
}

export const CLEAVE_SPLASH = 0.5;
export const FIREBALL_DAMAGE = 4;
export const FIREBALL_SPLASH = 0.25;
export const HEAL_HP = 5;

export const SPELLS = {
  cleave: {
    mp: 3,
    cooldown: 1,
    aim: { kind: "none" },
    summary: "Attack ahead, and half as hard to either side.",
  },
  fireball: {
    mp: 7,
    cooldown: 5,
    aim: { kind: "hex", range: 3 },
    summary: "Burn a hex in sight, and a quarter as hard around it.",
  },
  heal: {
    mp: 5,
    cooldown: 3,
    aim: { kind: "none" },
    summary: `Restore ${HEAL_HP} HP.`,
  },
  strike: {
    mp: 2,
    cooldown: 1,
    aim: { kind: "monster" },
    summary: "Face the adjacent target and attack it.",
  },
} as const satisfies Record<string, Spell>;

export type SpellId = keyof typeof SPELLS;

export const SPELL_IDS = Object.keys(SPELLS) as readonly SpellId[];

export const fireballSplashOf = (at: Hex): readonly Hex[] => neighborsOf(at);
