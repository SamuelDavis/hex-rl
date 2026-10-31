export type Relation = "hostile" | "friendly";

/** Each faction's foes; hostility is mutual, so listing it on either side suffices. */
export const FACTIONS = {
  wild: { hostile: ["town"] },
  town: { hostile: [] },
} as const satisfies Record<string, { readonly hostile: readonly string[] }>;

export type FactionId = keyof typeof FACTIONS;

const isFoeOf = (a: FactionId, b: FactionId): boolean =>
  (FACTIONS[a].hostile as readonly FactionId[]).includes(b);

export const relationOf = (a: FactionId, b: FactionId): Relation =>
  isFoeOf(a, b) || isFoeOf(b, a) ? "hostile" : "friendly";
