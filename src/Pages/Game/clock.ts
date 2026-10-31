/** What drives ticks (docs/time.md): never, the player's turn-spending input, or a timer at `ticksPerSecond`. */
export type Speed =
  | { readonly kind: "paused" }
  | { readonly kind: "turn-based" }
  | { readonly kind: "real-time"; readonly ticksPerSecond: number };

export const TURN_BASED: Speed = { kind: "turn-based" };

export const SPEEDS: readonly Speed[] = [
  { kind: "paused" },
  TURN_BASED,
  ...[1, 2, 3, 4, 6, 8].map((ticksPerSecond): Speed => ({
    kind: "real-time",
    ticksPerSecond,
  })),
];

/** Turn-spending Intents a seat may queue ahead of real-time ticks. */
export const BUFFER_TICKS = 2;

export const speedNameOf = (speed: Speed): string => {
  switch (speed.kind) {
    case "paused":
      return "Paused";
    case "turn-based":
      return "Turn-based";
    case "real-time":
      return `${speed.ticksPerSecond} tick${speed.ticksPerSecond === 1 ? "" : "s"}/s`;
  }
};

/** Milliseconds between ticks, if a timer drives them. */
export const intervalOf = (speed: Speed): number | undefined =>
  speed.kind === "real-time" ? 1000 / speed.ticksPerSecond : undefined;
