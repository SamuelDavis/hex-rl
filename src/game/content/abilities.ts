import type { Ability, Aim } from "../actions/abilities";
import type { PotionKind } from "../items";

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

/** Learnable by levelling. */
export const SPELLS = {
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
    aim: { kind: "creature" },
    effects: [
      { kind: "face" },
      { kind: "damage", area: "target", amount: PLAYER_DAMAGE },
    ],
    summary: "Face the adjacent target and attack it.",
  },
} as const satisfies Record<string, Ability>;

const inflicting = (
  condition: "bleed" | "stun" | "paralysis",
  turns: number,
  cooldown: number,
  chance: number,
): Ability => ({
  mp: 0,
  cooldown,
  spendsTurn: false,
  aim: NO_AIM,
  effects: [{ kind: "condition", area: "target", condition, turns }],
  trigger: { on: "hit", chance },
  summary: `Inflict ${condition} on a landed hit.`,
});

/** Creatures' abilities: each triggers by itself, at its chance, when its `trigger` occurs. Effects scale with the caster's level. */
const KNACKS = {
  "summon cubs": {
    mp: 0,
    cooldown: 15,
    spendsTurn: true,
    aim: NO_AIM,
    effects: [{ kind: "summon", creature: "cub", count: 1 }],
    trigger: { on: "hostile", chance: 0.3 },
    summary: "Summon a cub per level.",
  },
  bleed: inflicting("bleed", 1, 4, 0.35),
  stun: inflicting("stun", 0.5, 5, 0.15),
  paralyze: inflicting("paralysis", 1, 5, 0.15),
  restock: {
    mp: 0,
    cooldown: [100, 200],
    spendsTurn: true,
    aim: NO_AIM,
    effects: [{ kind: "restock", stock: 6, gold: 60 }],
    trigger: { on: "idle", chance: 0.2 },
    summary: "Refill wares and purse.",
  },
} as const satisfies Record<string, Ability>;

export const ABILITIES = {
  ...SPELLS,
  ...KNACKS,
  health: potion("health", "hp", HEALTH_POTION_HP),
  mana: potion("mana", "mp", MANA_POTION_MP),
} as const satisfies Record<string, Ability>;

export type SpellId = keyof typeof SPELLS;

export const SPELL_IDS = Object.keys(SPELLS) as readonly SpellId[];

export const isSpell = (id: AbilityId): id is SpellId => id in SPELLS;

export type AbilityId = keyof typeof ABILITIES;

export const ABILITY_IDS = Object.keys(ABILITIES) as readonly AbilityId[];

export const abilityOf = (id: AbilityId): Ability => ABILITIES[id];
