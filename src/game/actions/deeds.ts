import type { Entity, EntityId } from "../components";
import type { AbilityId, SpellId } from "../content/abilities";
import type { Direction, Hex } from "../hex";
import type { Game } from "../world";
import type { Where } from "./inventory";

export interface Move {
  readonly kind: "move";
  readonly direction: Direction;
}

export interface Turn {
  readonly kind: "turn";
  readonly direction: Direction;
}

export interface Step {
  readonly kind: "step";
  readonly direction: Direction;
}

export interface Attack {
  readonly kind: "attack";
  readonly at: Hex;
}

export interface Wait {
  readonly kind: "wait";
}

export interface Use {
  readonly kind: "use";
  readonly ability: AbilityId;
  readonly at?: Hex | undefined;
}

/** `Transfer.cargo` naming all gold held at its origin, rather than an item id. */
export const GOLD = "gold";

export interface Transfer {
  readonly kind: "transfer";
  readonly cargo: string;
  readonly to: Where;
}

export interface Prepare {
  readonly kind: "prepare";
}

export interface TakeAll {
  readonly kind: "take-all";
}

export interface Destroy {
  readonly kind: "destroy";
}

export interface Learn {
  readonly kind: "learn";
  readonly spell: SpellId;
}

export interface Interact {
  readonly kind: "interact";
  readonly at?: Hex | undefined;
}

/** Sells `item` from the pack to `trader`, or buys it from the trader's wares. */
export interface Trade {
  readonly kind: "trade";
  readonly trader: EntityId;
  readonly item: string;
}

/** A spawner brings forth a member, or its boss. */
export interface Spawn {
  readonly kind: "spawn";
}

export type Deed =
  | Turn
  | Step
  | Attack
  | Wait
  | Use
  | Transfer
  | TakeAll
  | Prepare
  | Destroy
  | Learn
  | Interact
  | Trade
  | Spawn;

export type DeedKind = Deed["kind"];

/** What an actor wants: a Deed, or to go a direction (step, turn or bump, by its Plan). */
export type Intent = Move | Deed;

/** A Deed to attempt, and per rejection reason the Plan to try next. */
export interface Plan {
  readonly attempt: Deed;
  readonly otherwise?: Partial<Record<Rejection, Plan>>;
}

export type Rejection =
  | "blocked"
  | "occupied"
  | "not-facing"
  | "already-facing"
  | "over"
  | "not-ready"
  | "no-mana"
  | "no-target"
  | "out-of-reach"
  | "out-of-range"
  | "out-of-sight"
  | "misfit"
  | "no-item"
  | "full"
  | "no-chest"
  | "unlearned"
  | "no-unlocks"
  | "gated"
  | "friendly"
  | "uninterested"
  | "no-gold"
  | "unable";

export type Outcome =
  | {
      readonly kind: "performed";
      readonly game: Game;
      readonly spendsTurn: boolean;
    }
  | { readonly kind: "rejected"; readonly reason: Rejection };

/** One Deed's checks and effects, for any `actor`; one lacking a component it needs is `unable`. */
export type Rule<D extends Deed> = (
  game: Game,
  deed: D,
  actor: Entity,
) => Outcome;

export const performed = (game: Game, spendsTurn = true): Outcome => ({
  kind: "performed",
  game,
  spendsTurn,
});

export const refused = (reason: Rejection): Outcome => ({
  kind: "rejected",
  reason,
});
