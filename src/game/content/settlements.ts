import { Biome, type Tile } from "../terrain";
import type { SpawnerKind } from "./creatures";

interface Tier {
  readonly kind: SpawnerKind;
  readonly level: number;
}

/** What a settlement is, lowest first: it becomes each tier's `kind` once its level reaches the tier's. Its boss is its highest rank. */
export const TIERS = [
  { kind: "town", level: 1 },
  { kind: "keep", level: 4 },
  { kind: "castle", level: 8 },
] as const satisfies readonly Tier[];

export const isSettlement = (kind: string): boolean =>
  TIERS.some((tier) => tier.kind === kind);

export const tierOf = (level: number): SpawnerKind =>
  TIERS.filter((tier) => tier.level <= level).at(-1)!.kind;

/** Outposts a settlement founds, one per level gained, each kind once; each sited where its site or a tile beside it passes. */
export const OUTPOSTS: Partial<Record<SpawnerKind, (tile: Tile) => boolean>> = {
  "gold mine": ({ biome }) => biome === Biome.Mountain,
  sawmill: ({ tree }) => tree,
  barracks: () => true,
  smithy: () => true,
  stables: ({ biome }) => biome === Biome.Plains,
  farm: ({ biome }) => biome === Biome.Plains,
  docks: ({ water }) => water !== undefined,
  bazaar: ({ biome }) => biome === Biome.Desert,
};
