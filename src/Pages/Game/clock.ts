/** What drives ticks (docs/time.md), set by the player alone: paused, nothing fires; 0 ticks per second is turn-based, a tick on each turn-spending action; more is real time. */
export interface Speed {
  readonly ticksPerSecond: number;
  readonly isPaused: boolean;
}

export const TURN_BASED: Speed = { ticksPerSecond: 0, isPaused: false };

/** Turn-spending Intents a seat may queue ahead of real-time ticks. */
export const BUFFER_TICKS = 2;

export const isTurnBased = ({ ticksPerSecond }: Speed): boolean =>
  ticksPerSecond === 0;

/** Milliseconds between ticks, if a timer drives them. */
export const intervalOf = (speed: Speed): number | undefined =>
  speed.isPaused || isTurnBased(speed)
    ? undefined
    : 1000 / speed.ticksPerSecond;
