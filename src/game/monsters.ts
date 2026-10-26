export const MONSTERS = {
  wolf: { glyph: "w", hue: 30, hp: 3, damage: 1 },
  goblin: { glyph: "g", hue: 90, hp: 4, damage: 2 },
  troll: { glyph: "T", hue: 280, hp: 8, damage: 3 },
} as const;

export type MonsterKind = keyof typeof MONSTERS;

export const monsterWeightsAt = (
  danger: number,
): (readonly [MonsterKind, number])[] => [
  ["wolf", Math.max(1, 5 - danger)],
  ["goblin", danger],
  ["troll", Math.max(0, danger - 2)],
];
