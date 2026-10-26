import type { Bounds, Vec2 } from "procgen";

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export const DIRECTIONS = {
  n: { q: 0, r: -1 },
  ne: { q: 1, r: -1 },
  se: { q: 1, r: 0 },
  s: { q: 0, r: 1 },
  sw: { q: -1, r: 1 },
  nw: { q: -1, r: 0 },
} as const satisfies Record<string, Hex>;

export type Direction = keyof typeof DIRECTIONS;

export const HEADINGS = Object.keys(DIRECTIONS) as readonly Direction[];

const SQRT3 = Math.sqrt(3);

export const hexKey = ({ q, r }: Hex): string => `${q},${r}`;

export const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export const neighborsOf = (hex: Hex): Hex[] =>
  Object.values(DIRECTIONS).map((direction) => add(hex, direction));

export const directionBetween = (from: Hex, to: Hex): Direction | undefined =>
  HEADINGS.find((direction) => sameHex(add(from, DIRECTIONS[direction]), to));

export const directionToward = ({ x, y }: Vec2): Direction => {
  const alignment = (direction: Direction) => {
    const toward = centerOf(DIRECTIONS[direction]);
    return toward.x * x + toward.y * y;
  };
  return HEADINGS.reduce((best, direction) =>
    alignment(direction) > alignment(best) ? direction : best,
  );
};

export const centerOf = ({ q, r }: Hex): Vec2 => ({
  x: 1.5 * q,
  y: SQRT3 * (r + q / 2),
});

export const CORNERS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: 0.5, y: SQRT3 / 2 },
  { x: -0.5, y: SQRT3 / 2 },
  { x: -1, y: 0 },
  { x: -0.5, y: -SQRT3 / 2 },
  { x: 0.5, y: -SQRT3 / 2 },
];

const roundAxial = (q: number, r: number): Hex => {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
};

export const hexAt = ({ x, y }: Vec2): Hex =>
  roundAxial(x / 1.5, y / SQRT3 - x / 3);

export const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

const NUDGE = 1e-6;

export const lineBetween = (from: Hex, to: Hex): Hex[] => {
  const steps = hexDistance(from, to);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = steps === 0 ? 0 : i / steps;
    return roundAxial(
      from.q + NUDGE + (to.q - from.q) * t,
      from.r + NUDGE + (to.r - from.r) * t,
    );
  });
};

export const hexesWithin = (radius: number): Hex[] => {
  const hexes: Hex[] = [];
  for (let q = -radius; q <= radius; q++)
    for (
      let r = Math.max(-radius, -q - radius);
      r <= Math.min(radius, -q + radius);
      r++
    )
      hexes.push({ q, r });
  return hexes;
};

export const hexesCovering = ({ minX, minY, maxX, maxY }: Bounds): Hex[] => {
  const hexes: Hex[] = [];
  for (let q = Math.ceil(minX / 1.5); q <= Math.floor(maxX / 1.5); q++)
    for (
      let r = Math.ceil(minY / SQRT3 - q / 2);
      r <= Math.floor(maxY / SQRT3 - q / 2);
      r++
    )
      hexes.push({ q, r });
  return hexes;
};
