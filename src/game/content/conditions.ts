import type { ConditionType } from "../conditions";

/** Bleed, stun and paralysis are inflicted; vigor, focus and mending are permanent regeneration. */
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
  vigor: {
    every: {
      interval: 10,
      effects: [{ kind: "restore", stat: "hp", amount: 1 }],
    },
  },
  focus: {
    every: {
      interval: 2,
      effects: [{ kind: "restore", stat: "mp", amount: 1 }],
    },
  },
  mending: {
    every: {
      interval: 5,
      effects: [{ kind: "restore", stat: "hp", amount: 1 }],
    },
  },
} as const satisfies Record<string, ConditionType>;

export type ConditionId = keyof typeof CONDITIONS;

export const conditionOf = (id: ConditionId): ConditionType => CONDITIONS[id];
