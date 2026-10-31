import type { DeedKind } from "./actions/deeds";
import type { ConditionState } from "./components";
import { conditionOf, type ConditionId } from "./content/conditions";
import type { Effect } from "./effects";
import type { Who } from "./events";

/** A condition's rules; rows in `content/conditions.ts`. */
export interface ConditionType {
  /** While suffered, only these Deeds may be performed. */
  readonly allows?: readonly DeedKind[];
  /** While suffered, these Deeds may not be performed. */
  readonly forbids?: readonly DeedKind[];
  /** Each turn suffered adds this much to the chance of shaking it off that turn. */
  readonly shakeOff?: number;
  /** Applied to the bearer every `interval` turns since it began. */
  readonly every?: {
    readonly interval: number;
    readonly effects: readonly Effect[];
  };
}

export type Suffered = ReadonlyMap<ConditionId, ConditionState>;

export const NONE: Suffered = new Map();

/** Permanent conditions, as an entity is built with them. */
export const permanent = (
  source: Who,
  ...ids: readonly ConditionId[]
): Suffered => new Map(ids.map((id) => [id, { since: 0, source }]));

const isCurrent = ({ since, until }: ConditionState, turn: number) =>
  since <= turn && (until === undefined || turn < until);

/** Turns `id` lasts at most; 0 when not suffered, `Infinity` when permanent. */
export const remainingOf = (
  conditions: Suffered,
  id: ConditionId,
  turn: number,
): number => {
  const state = conditions.get(id);
  if (!state) return 0;
  return state.until === undefined ? Infinity : Math.max(0, state.until - turn);
};

/** Suffered from the next turn for `turns` turns, or extended to then; a permanent condition stays as it is. */
export const inflicted = (
  conditions: Suffered,
  id: ConditionId,
  turn: number,
  turns: number,
  source: Who,
): Suffered => {
  const suffered = conditions.get(id);
  if (suffered && suffered.until === undefined) return conditions;
  const since = suffered?.since ?? turn + 1;
  const until = Math.max(suffered?.until ?? 0, turn + 1 + turns);
  if (until === suffered?.until) return conditions;
  return new Map([...conditions, [id, { since, until, source }]]);
};

/** The condition, if any, that keeps `deed` from being performed. */
export const gateOf = (
  conditions: Suffered,
  deed: DeedKind,
  turn: number,
): ConditionId | undefined =>
  [...conditions].find(([id, state]) => {
    const { allows, forbids } = conditionOf(id);
    return (
      isCurrent(state, turn) &&
      ((allows !== undefined && !allows.includes(deed)) ||
        (forbids?.includes(deed) ?? false))
    );
  })?.[0];

/** Conditions whose `every` effects fall due on `turn`: each `interval`-th turn suffered. */
export const dueOf = (
  conditions: Suffered,
  turn: number,
): readonly (readonly [ConditionId, ConditionState])[] =>
  [...conditions].filter(([id, state]) => {
    const every = conditionOf(id).every;
    return (
      every !== undefined &&
      isCurrent(state, turn) &&
      (turn - state.since + 1) % every.interval === 0
    );
  });

export const shakeOffChanceOf = (
  id: ConditionId,
  { since }: ConditionState,
  turn: number,
): number =>
  Math.min(1, Math.max(0, (conditionOf(id).shakeOff ?? 0) * (turn - since)));

/** Drops what wore off by `turn` and what `isShaken` (rolled at `shakeOffChanceOf`) shakes off; permanent ones stay. */
export const recovered = (
  conditions: Suffered,
  turn: number,
  isShaken: (id: ConditionId, chance: number) => boolean,
): { readonly kept: Suffered; readonly lost: readonly ConditionId[] } => {
  const lost = [...conditions].flatMap(([id, state]) =>
    state.until !== undefined &&
    (turn >= state.until || isShaken(id, shakeOffChanceOf(id, state, turn)))
      ? [id]
      : [],
  );
  if (lost.length === 0) return { kept: conditions, lost };
  const kept = new Map([...conditions].filter(([id]) => !lost.includes(id)));
  return { kept, lost };
};
