import type { Deed, DeedKind, Intent, Rejection } from "./actions/deeds";
import type { EntityId, Kind } from "./components";
import type { AbilityId, SpellId } from "./content/abilities";
import type { ConditionId } from "./content/conditions";
import type { CreatureKind, SpawnerKind } from "./content/creatures";
import type { FactionId } from "./content/factions";
import type { Direction, Hex } from "./hex";
import type { Item } from "./items";
import type { Biome } from "./terrain";
import type { Cargo, Where } from "./actions/inventory";

/** Who an event concerns: enough to name them and tell them apart without the game state. */
export interface Who {
  readonly id: EntityId;
  readonly kind: Kind;
  readonly faction: FactionId;
  /** Biome of its home, or of where a spawner stands; townsfolk and towns are known by it. */
  readonly biome?: Biome;
}

/** What produced an event: the Deed performed, an ability it used or triggered, a condition suffered, or a system's upkeep. */
export type Cause =
  | { readonly kind: "deed"; readonly deed: DeedKind }
  | { readonly kind: "ability"; readonly ability: AbilityId }
  | { readonly kind: "condition"; readonly condition: ConditionId }
  | { readonly kind: "system"; readonly system: SystemId };

export type SystemId = "chunks" | "vision";

/** Every event names its `source`, who did it or to whom it happened, and `target`, if any, who it was done to. `cause` is stamped by whatever produced it. */
export type GameEvent = { readonly cause?: Cause } & (
  | { readonly kind: "began"; readonly source: Who }
  | {
      readonly kind: "rejected";
      readonly source: Who;
      readonly action: Intent | Deed;
      readonly reason: Rejection;
    }
  | {
      readonly kind: "turned";
      readonly source: Who;
      readonly facing: Direction;
    }
  | {
      readonly kind: "stepped";
      readonly source: Who;
      readonly direction: Direction;
      readonly to: Hex;
    }
  | { readonly kind: "used"; readonly source: Who; readonly ability: AbilityId }
  | {
      readonly kind: "hurt";
      readonly source: Who;
      readonly target: Who;
      readonly amount: number;
    }
  | { readonly kind: "killed"; readonly source: Who; readonly target: Who }
  | { readonly kind: "wrecked"; readonly source: Who; readonly target: Who }
  | { readonly kind: "dropped"; readonly source: Who }
  | {
      readonly kind: "moved";
      readonly source: Who;
      readonly cargo: Cargo;
      readonly from: Where;
      readonly to: Where;
    }
  | {
      readonly kind: "spilled";
      readonly source: Who;
      readonly items: readonly Item[];
    }
  | { readonly kind: "destroyed"; readonly source: Who }
  | { readonly kind: "prepared"; readonly source: Who }
  | { readonly kind: "emerged"; readonly source: Who }
  | { readonly kind: "leveled"; readonly source: Who; readonly level: number }
  | {
      readonly kind: "learned";
      readonly source: Who;
      readonly spell: SpellId;
      readonly level: number;
    }
  | {
      readonly kind: "summoned";
      readonly source: Who;
      readonly summoned: CreatureKind;
      readonly count: number;
    }
  | {
      readonly kind: "conditioned";
      readonly source: Who;
      readonly target: Who;
      readonly condition: ConditionId;
      readonly turns: number;
    }
  | {
      readonly kind: "struggled";
      readonly source: Who;
      readonly condition: ConditionId;
    }
  | {
      readonly kind: "recovered";
      readonly source: Who;
      readonly condition: ConditionId;
    }
  | { readonly kind: "restocked"; readonly source: Who }
  | { readonly kind: "interacted"; readonly source: Who; readonly target: Who }
  | {
      readonly kind: "bought" | "sold";
      readonly source: Who;
      readonly target: Who;
      readonly item: Item;
      readonly price: number;
    }
  | {
      readonly kind: "bountied";
      readonly source: Who;
      readonly target: Who;
      readonly spawner: SpawnerKind;
      readonly at: Hex;
      readonly level: number;
    }
  | { readonly kind: "bountySlain"; readonly source: Who; readonly target: Who }
  | {
      readonly kind: "rewarded";
      readonly source: Who;
      readonly target: Who;
      readonly gold: number;
    }
);
