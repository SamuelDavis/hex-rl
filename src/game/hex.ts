import type { Vec2 } from "procgen";

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

export const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
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

const roundHex = (q: number, r: number): Hex => {
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

const NUDGE = 1e-6;

export const lineBetween = (from: Hex, to: Hex): Hex[] => {
  const steps = hexDistance(from, to);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = steps === 0 ? 0 : i / steps;
    return roundHex(
      from.q + NUDGE + (to.q - from.q) * t,
      from.r + NUDGE + (to.r - from.r) * t,
    );
  });
};

export const distancesFrom = (
  start: Hex,
  isPassable: (hex: Hex) => boolean,
): Map<string, number> => {
  const distances = new Map([[hexKey(start), 0]]);
  const frontier = [start];
  for (let hex = frontier.shift(); hex; hex = frontier.shift()) {
    const next = distances.get(hexKey(hex))! + 1;
    for (const neighbor of neighborsOf(hex)) {
      const key = hexKey(neighbor);
      if (distances.has(key) || !isPassable(neighbor)) continue;
      distances.set(key, next);
      frontier.push(neighbor);
    }
  }
  return distances;
};
