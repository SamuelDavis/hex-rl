import type { DeedKind } from "./actions/deeds";
import type { ConditionState } from "./components";
import { conditionOf, type ConditionId } from "./content/conditions";
import type { Effect } from "./effects";
import type { Who } from "./events";

/** A condition's rules; rows in `content/conditions.ts`. Durations and intervals count the bearer's own turns. */
export interface ConditionType {
  /** While suffered, only these Deeds may be performed. */
  readonly allows?: readonly DeedKind[];
  /** While suffered, these Deeds may not be performed. */
  readonly forbids?: readonly DeedKind[];
  /** Each turn suffered adds this much to the chance of shaking it off at that turn's end. */
  readonly shakeOff?: number;
  /** Applied to the bearer at the start of every `interval`-th turn it suffers this. */
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
): Suffered => new Map(ids.map((id) => [id, { source, suffered: 0 }]));

/** Turns `id` lasts at most; 0 when not suffered, `Infinity` when permanent. */
export const remainingOf = (conditions: Suffered, id: ConditionId): number => {
  const state = conditions.get(id);
  return state ? (state.remaining ?? Infinity) : 0;
};

/** Registered now, taking effect from the bearer's next turn for `turns` of its turns; inflicting again extends it. A permanent condition stays as it is. */
export const inflicted = (
  conditions: Suffered,
  id: ConditionId,
  turns: number,
  source: Who,
): Suffered => {
  const suffered = conditions.get(id);
  if (suffered && suffered.remaining === undefined) return conditions;
  const remaining = Math.max(suffered?.remaining ?? 0, turns);
  if (remaining === suffered?.remaining) return conditions;
  return new Map([
    ...conditions,
    [id, { source, suffered: suffered?.suffered ?? 0, remaining }],
  ]);
};

/** The condition, if any, that keeps `deed` from being performed. */
export const gateOf = (
  conditions: Suffered,
  deed: DeedKind,
): ConditionId | undefined =>
  [...conditions.keys()].find((id) => {
    const { allows, forbids } = conditionOf(id);
    return (
      (allows !== undefined && !allows.includes(deed)) ||
      (forbids?.includes(deed) ?? false)
    );
  });

/** The start of the bearer's turn: each condition suffered a turn longer, and those whose `every` effects fall due. */
export const begun = (
  conditions: Suffered,
): {
  readonly conditions: Suffered;
  readonly due: readonly (readonly [ConditionId, ConditionState])[];
} => {
  const next = new Map(
    [...conditions].map(([id, state]) => [
      id,
      { ...state, suffered: state.suffered + 1 },
    ]),
  );
  const due = [...next].filter(([id, { suffered }]) => {
    const every = conditionOf(id).every;
    return every !== undefined && suffered % every.interval === 0;
  });
  return { conditions: next, due };
};

export const shakeOffChanceOf = (
  id: ConditionId,
  { suffered }: ConditionState,
): number => Math.min(1, (conditionOf(id).shakeOff ?? 0) * suffered);

const isTicking = ({ remaining, suffered }: ConditionState) =>
  remaining !== undefined && suffered > 0;

/** The end of the bearer's turn: each timed condition it suffered this turn has a turn less, and is lost when spent or when `isShaken` (rolled at `shakeOffChanceOf`) shakes it off. Ones inflicted during the turn, and permanent ones, stay as they are. */
export const recovered = (
  conditions: Suffered,
  isShaken: (id: ConditionId, chance: number) => boolean,
): { readonly kept: Suffered; readonly lost: readonly ConditionId[] } => {
  const ticking = [...conditions].filter(([, state]) => isTicking(state));
  if (ticking.length === 0) return { kept: conditions, lost: [] };
  const lost = ticking.flatMap(([id, state]) =>
    state.remaining! <= 1 || isShaken(id, shakeOffChanceOf(id, state))
      ? [id]
      : [],
  );
  const kept = new Map(
    [...conditions]
      .filter(([id]) => !lost.includes(id))
      .map(([id, state]) => [
        id,
        isTicking(state)
          ? { ...state, remaining: state.remaining! - 1 }
          : state,
      ]),
  );
  return { kept, lost };
};
