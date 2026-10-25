export const MONSTERS = {
  rat: { glyph: "r", hp: 2, damage: 1 },
  goblin: { glyph: "g", hp: 4, damage: 2 },
  orc: { glyph: "o", hp: 7, damage: 3 },
} as const;

export type MonsterKind = keyof typeof MONSTERS;

export const monsterWeightsAt = (
  depth: number,
): (readonly [MonsterKind, number])[] => [
  ["rat", Math.max(1, 5 - depth)],
  ["goblin", depth],
  ["orc", Math.max(0, depth - 2)],
];
