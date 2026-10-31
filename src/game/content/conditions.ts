import type { ConditionType } from "../conditions";

/** Bleed, stun and paralysis are inflicted; regeneration and mana regeneration are permanent. */
export const CONDITIONS = {
  bleed: {
    shakeOff: 0.15,
    every: {
      interval: 1,
      effects: [{ kind: "damage", area: "self", amount: 1 }],
    },
  },
  stun: { shakeOff: 0.3, allows: ["wait"] },
  paralysis: { shakeOff: 0.25, forbids: ["turn", "step"] },
  regeneration: {
    every: {
      interval: 10,
      effects: [{ kind: "restore", stat: "hp", amount: 1 }],
    },
  },
  "mana regeneration": {
    every: {
      interval: 2,
      effects: [{ kind: "restore", stat: "mp", amount: 1 }],
    },
  },
} as const satisfies Record<string, ConditionType>;

export type ConditionId = keyof typeof CONDITIONS;

export const conditionOf = (id: ConditionId): ConditionType => CONDITIONS[id];
