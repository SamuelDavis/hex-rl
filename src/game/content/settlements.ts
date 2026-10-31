import { Biome, TOWN_CLEARING, type Tile } from "../terrain";
import type { SpawnerKind } from "./creatures";

interface Tier {
  readonly kind: SpawnerKind;
  readonly level: number;
  /** Radius it levels around itself, in hexes. */
  readonly clearing: number;
}

/** What a settlement is, lowest first: it becomes each tier's `kind` once its level reaches the tier's. Its boss is its highest rank. */
export const TIERS = [
  { kind: "town", level: 1, clearing: TOWN_CLEARING },
  { kind: "keep", level: 2, clearing: 3 },
  { kind: "castle", level: 4, clearing: 4 },
] as const satisfies readonly Tier[];

const rankOf = (kind: string): number =>
  TIERS.findIndex((tier) => tier.kind === kind);

export const isSettlement = (kind: string): boolean => rankOf(kind) >= 0;

export const tierOf = (level: number): SpawnerKind =>
  TIERS.filter((tier) => tier.level <= level).at(-1)!.kind;

/** Whether a settlement of `kind` has reached `tier`. */
export const hasReached = (kind: SpawnerKind, tier: SpawnerKind): boolean =>
  rankOf(kind) >= rankOf(tier);

/** Radius an outpost levels around itself, in hexes. */
const OUTPOST_CLEARING = 1;

/** Radius a settlement or outpost levels around itself. */
export const clearingOf = (kind: SpawnerKind): number =>
  TIERS[rankOf(kind)]?.clearing ?? OUTPOST_CLEARING;

export const LARGEST_CLEARING = Math.max(
  ...TIERS.map(({ clearing }) => clearing),
);

interface Outpost {
  /** Sited where its site or a tile beside it passes. */
  readonly suits: (tile: Tile) => boolean;
  /** The tier its settlement must have reached. */
  readonly needs?: SpawnerKind;
}

/** Outposts a settlement founds, one per level gained, each kind once. */
export const OUTPOSTS: Partial<Record<SpawnerKind, Outpost>> = {
  "gold mine": { suits: ({ biome }) => biome === Biome.Mountain },
  sawmill: { suits: ({ tree }) => tree },
  barracks: { suits: () => true, needs: "keep" },
  smithy: { suits: () => true },
  stables: { suits: ({ biome }) => biome === Biome.Plains, needs: "keep" },
  farm: { suits: ({ biome }) => biome === Biome.Plains },
  docks: { suits: ({ water }) => water !== undefined },
  bazaar: { suits: ({ biome }) => biome === Biome.Desert },
};
