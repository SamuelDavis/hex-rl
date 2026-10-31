import { has, type Entity, type EntityId } from "../components";
import { gateOf } from "../conditions";
import type { ConditionId } from "../content/conditions";
import { add, DIRECTIONS, type Direction, type Hex } from "../hex";
import { caused, recorded, whoIs, type Game } from "../world";
import { learn, use } from "./abilities";
import { attack } from "./combat";
import {
  performed,
  refused,
  type Deed,
  type Intent,
  type Outcome,
  type Plan,
  type Rejection,
  type Rule,
} from "./deeds";
import { destroy, prepare, takeAll, transfer } from "./inventory";
import { step, turn } from "./movement";
import { interact, trade } from "./towns";

const RULES: {
  readonly [K in Deed["kind"]]: Rule<Extract<Deed, { kind: K }>>;
} = {
  turn,
  step,
  attack,
  wait: (game) => performed(game),
  use,
  transfer,
  "take-all": takeAll,
  prepare,
  destroy,
  learn,
  interact,
  trade,
};

/** A Rule's outcome, rejected as `gated` when a condition the actor suffers forbids the Deed; checked after the Rule's own checks, so a bump still finds its foe. */
const outcomeOf = <D extends Deed>(
  game: Game,
  deed: D,
  actor: Entity,
): Outcome => {
  const outcome = (RULES[deed.kind] as Rule<D>)(game, deed, actor);
  if (outcome.kind === "rejected" || !gatedBy(actor, deed)) return outcome;
  return refused("gated");
};

const gatedBy = (actor: Entity, deed: Deed): ConditionId | undefined =>
  actor.conditions && gateOf(actor.conditions, deed.kind);

/** Step the way faced, else turn that way, else `bump` whoever is in the way. */
const moving = (direction: Direction, bump: Plan): Plan => ({
  attempt: { kind: "step", direction },
  otherwise: {
    "not-facing": { attempt: { kind: "turn", direction } },
    occupied: bump,
  },
});

const bold = (ahead: Hex): Plan => ({ attempt: { kind: "attack", at: ahead } });

/** Bold toward foes; interacts with friends. */
const courteous = (ahead: Hex): Plan => ({
  attempt: { kind: "attack", at: ahead },
  otherwise: { friendly: { attempt: { kind: "interact", at: ahead } } },
});

/** Seats are courteous; minds are bold. */
export const planOf = (actor: Entity, intent: Intent): Plan => {
  if (intent.kind !== "move" || !actor.at) return { attempt: intent as Deed };
  const ahead = add(actor.at, DIRECTIONS[intent.direction]);
  const policy = actor.controller === "seat" ? courteous : bold;
  return moving(intent.direction, policy(ahead));
};

interface Attempt {
  readonly deed: Deed;
  readonly outcome: Outcome;
}

const attempted = (
  game: Game,
  actor: Entity,
  { attempt, otherwise }: Plan,
): Attempt => {
  const outcome = outcomeOf(game, attempt, actor);
  const next =
    outcome.kind === "rejected" ? otherwise?.[outcome.reason] : undefined;
  return next ? attempted(game, actor, next) : { deed: attempt, outcome };
};

export interface Settlement {
  readonly game: Game;
  readonly spendsTurn: boolean;
}

const rejected = (
  game: Game,
  actor: Entity,
  deed: Deed,
  reason: Rejection,
): Settlement => ({
  game: recorded(game, {
    kind: "rejected",
    source: whoIs(game, actor),
    action: deed,
    reason,
  }),
  spendsTurn: false,
});

/** A gated actor loses the turn struggling, which counts toward shaking the condition off. */
const struggled = (
  game: Game,
  actor: Entity,
  condition: ConditionId,
): Settlement => ({
  game: recorded(game, {
    kind: "struggled",
    source: whoIs(game, actor),
    condition,
  }),
  spendsTurn: true,
});

/** Walks `plan` for `actor`; its events are caused by the Deed performed. A rejected Plan spends nothing, except a struggle. */
export const settled = (game: Game, id: EntityId, plan: Plan): Settlement => {
  const actor = game.entities.get(id);
  if (!actor || !has(actor, "agent")) return { game, spendsTurn: false };
  const { deed, outcome } = attempted(game, actor, plan);
  const cause = { kind: "deed", deed: deed.kind } as const;
  if (outcome.kind === "performed")
    return {
      game: caused(game, cause, () => outcome.game),
      spendsTurn: outcome.spendsTurn,
    };
  const condition =
    outcome.reason === "gated" ? gatedBy(actor, deed) : undefined;
  const settlement = condition
    ? struggled(game, actor, condition)
    : rejected(game, actor, deed, outcome.reason);
  return {
    ...settlement,
    game: caused(game, cause, () => settlement.game),
  };
};
