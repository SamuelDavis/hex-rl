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

const SQRT3 = Math.sqrt(3);

export const hexKey = ({ q, r }: Hex): string => `${q},${r}`;

export const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

export const neighborsOf = (hex: Hex): Hex[] =>
  Object.values(DIRECTIONS).map((direction) => add(hex, direction));

export const directionBetween = (from: Hex, to: Hex): Direction | undefined =>
  (Object.keys(DIRECTIONS) as Direction[]).find((direction) =>
    sameHex(add(from, DIRECTIONS[direction]), to),
  );

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

export const hexAt = ({ x, y }: Vec2): Hex => {
  const q = x / 1.5;
  const r = y / SQRT3 - q / 2;
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
