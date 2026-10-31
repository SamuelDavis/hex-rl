export type Affliction = "bleed" | "stun" | "paralysis";

/** One affliction suffered: the turn it began and the turn it wears off at the latest. */
export interface Status {
  readonly since: number;
  readonly until: number;
}

export type Afflictions = ReadonlyMap<Affliction, Status>;

export const NONE: Afflictions = new Map();

/** `shakeOff`: each turn suffered adds this much to the chance of shaking it off that turn. */
export const AFFLICTIONS: Readonly<
  Record<Affliction, { readonly shakeOff: number }>
> = {
  bleed: { shakeOff: 0.15 },
  stun: { shakeOff: 0.3 },
  paralysis: { shakeOff: 0.25 },
};

export const remainingOf = (
  afflictions: Afflictions,
  affliction: Affliction,
  turn: number,
): number => Math.max(0, (afflictions.get(affliction)?.until ?? 0) - turn);

export const inflicted = (
  afflictions: Afflictions,
  affliction: Affliction,
  turn: number,
  turns: number,
): Afflictions => {
  const suffered = afflictions.get(affliction);
  const until = Math.max(suffered?.until ?? 0, turn + turns);
  if (suffered && until === suffered.until) return afflictions;
  const since = suffered?.since ?? turn;
  return new Map([...afflictions, [affliction, { since, until }]]);
};

export const shakeOffChanceOf = (
  affliction: Affliction,
  { since }: Status,
  turn: number,
): number => Math.min(1, AFFLICTIONS[affliction].shakeOff * (turn - since));

/** Drops what wore off by `turn` and what `isShaken` (rolled at `shakeOffChanceOf`) shakes off. */
export const recovered = (
  afflictions: Afflictions,
  turn: number,
  isShaken: (affliction: Affliction, chance: number) => boolean,
): { readonly kept: Afflictions; readonly lost: readonly Affliction[] } => {
  const lost = [...afflictions].flatMap(([affliction, status]) =>
    turn >= status.until ||
    isShaken(affliction, shakeOffChanceOf(affliction, status, turn))
      ? [affliction]
      : [],
  );
  if (lost.length === 0) return { kept: afflictions, lost };
  const kept = new Map(
    [...afflictions].filter(([affliction]) => !lost.includes(affliction)),
  );
  return { kept, lost };
};
