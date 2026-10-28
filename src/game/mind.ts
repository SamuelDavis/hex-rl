import { sameHex, type Direction, type Hex } from "./hex";

export const TRACK_TURNS = 3;
export const HUNT_TURNS = 10;

export interface Quarry {
  readonly at: Hex;
  readonly facing: Direction;
}

interface Pursuit {
  /** Where it stood idle when it found the player; its leash while engaged. */
  readonly anchor: Hex;
  readonly lastSeen: Hex;
  /** The player's facing when last seen. */
  readonly heading: Direction;
}

export interface Idle {
  readonly state: "idle";
}

export interface Hostile extends Pursuit {
  readonly state: "hostile";
  readonly unseenFor: number;
}

export interface Hunting extends Pursuit {
  readonly state: "hunting";
  readonly huntedFor: number;
}

export type Engaged = Hostile | Hunting;
export type Mind = Idle | Engaged;

export const IDLE: Idle = { state: "idle" };

export const sighted = (mind: Mind, at: Hex, quarry: Quarry): Hostile => ({
  state: "hostile",
  anchor: mind.state === "idle" ? at : mind.anchor,
  lastSeen: quarry.at,
  heading: quarry.facing,
  unseenFor: 0,
});

export const tetherOf = (mind: Mind, home: Hex): Hex =>
  mind.state === "idle" ? home : mind.anchor;

const hunting = ({ anchor, lastSeen, heading }: Pursuit): Hunting => ({
  state: "hunting",
  anchor,
  lastSeen,
  heading,
  huntedFor: 0,
});

export const unsighted = (mind: Mind, at: Hex): Mind => {
  switch (mind.state) {
    case "idle":
      return mind;
    case "hostile": {
      const unseenFor = mind.unseenFor + 1;
      return unseenFor < TRACK_TURNS && !sameHex(at, mind.lastSeen)
        ? { ...mind, unseenFor }
        : hunting(mind);
    }
    case "hunting": {
      const huntedFor = mind.huntedFor + 1;
      return huntedFor < HUNT_TURNS ? { ...mind, huntedFor } : IDLE;
    }
  }
};
