import {
  act,
  creaturesOf,
  immediate,
  tick,
  newGame,
  playerOf,
  PLAYER,
  type Intent,
  type Destroy,
  type Game,
  type GameEvent,
  type Learn,
  type Creature,
  type Prepare,
  type TakeAll,
  type Trade,
  type Transfer,
} from "../../game/game";
import { directionBetween, hexKey, sameHex, type Hex } from "../../game/hex";
import { EXPLORE, transition, type Command, type Mode } from "./mode";
import {
  nextTarget,
  targetInView,
  targetOf,
  tracked,
  type Target,
} from "./target";
import { createTerrain } from "../../game/terrain";
import { BUFFER_TICKS, TURN_BASED, type Speed } from "./clock";

export const LOG_LENGTH = 50;

export interface Session {
  readonly game: Game;
  readonly mode: Mode;
  readonly target: Target | undefined;
  /** Opens on stepping onto a chest; once dismissed, stays shut until the next step. */
  readonly isInventoryOpen: boolean;
  /** Who the player last interacted with; their dialog shows while they stay beside the player. */
  readonly conversant: Creature["id"] | undefined;
  /** How far, in hexes, the view shows; targets beyond it can't be chosen. */
  readonly range: number;
  readonly log: readonly GameEvent[];
  readonly speed: Speed;
  /** Turn-spending Intents waiting for real-time ticks, oldest first. */
  readonly queue: readonly Intent[];
}

export type Message =
  | Command
  | { readonly kind: "cycleTarget" }
  | { readonly kind: "inventory" }
  | { readonly kind: "dismiss" }
  | Transfer
  | Trade
  | TakeAll
  | Prepare
  | Destroy
  | Learn
  | { readonly kind: "view"; readonly range: number }
  | { readonly kind: "speed"; readonly speed: Speed }
  | { readonly kind: "tick" };

export const sessionOf = (game: Game, range: number): Session => ({
  game,
  mode: EXPLORE,
  target: undefined,
  isInventoryOpen: false,
  conversant: undefined,
  range,
  log: game.events,
  speed: TURN_BASED,
  queue: [],
});

/** Starts at the dry, treeless hex nearest `near`. */
export const newSession = (
  seed: number,
  range: number,
  near: Hex = { q: 0, r: 0 },
): Session => {
  const terrain = createTerrain(seed);
  return sessionOf(newGame(terrain, terrain.startNear(near)), range);
};

export const targetedAt = ({ game, range, target }: Session): Hex | undefined =>
  target && targetInView(game, range, target)?.at;

export const conversantOf = ({
  game,
  conversant,
}: Session): Creature | undefined => {
  const creature = creaturesOf(game).find(({ id }) => id === conversant);
  return creature && directionBetween(playerOf(game).at, creature.at)
    ? creature
    : undefined;
};

/** Whom the player tried to interact with this action, whether or not they could. */
const addresseeOf = (game: Game): Creature | undefined => {
  const creatures = creaturesOf(game);
  for (const event of game.events) {
    if (event.kind === "interacted")
      return creatures.find(({ id }) => id === event.target.id);
    if (event.kind === "rejected" && event.action.kind === "interact") {
      const { at } = event.action;
      return at && creatures.find((creature) => sameHex(creature.at, at));
    }
  }
  return undefined;
};

/** `session` advanced to `game`, which its last action or tick produced. */
const advanced = (session: Session, game: Game): Session => {
  const { range, target, log } = session;
  const hasStepped = game.events.some(
    (event) => event.kind === "stepped" && event.source.id === PLAYER,
  );
  const interacted = game.events.find((event) => event.kind === "interacted");
  const addressee = addresseeOf(game);
  return {
    ...session,
    game,
    isInventoryOpen: hasStepped
      ? game.chests.has(hexKey(playerOf(game).at))
      : session.isInventoryOpen,
    conversant:
      interacted?.target.id ?? (hasStepped ? undefined : session.conversant),
    target: addressee
      ? targetOf(game, addressee)
      : target && tracked(game, range, target),
    log: [...log, ...game.events].slice(-LOG_LENGTH),
  };
};

/** The player's Intent: dropped while paused; resolved at once turn-based; in real time, free Deeds and rejections at once, others queued for a tick if the queue has room. */
const performed = (session: Session, intent: Intent): Session => {
  const { game, speed, queue } = session;
  switch (speed.kind) {
    case "paused":
      return session;
    case "turn-based":
      return advanced(session, act(game, intent));
    case "real-time": {
      const now = immediate(game, intent);
      if (now) return advanced(session, now);
      return queue.length < BUFFER_TICKS
        ? { ...session, queue: [...queue, intent] }
        : session;
    }
  }
};

/** A real-time tick: the oldest queued Intent is the player's, else the player passes. */
const ticked = (session: Session): Session => {
  if (session.speed.kind !== "real-time") return session;
  const [next, ...rest] = session.queue;
  const intents = new Map(next ? [[PLAYER, next]] : []);
  return advanced({ ...session, queue: rest }, tick(session.game, intents));
};

const commanded = (session: Session, command: Command): Session => {
  if (
    command.kind === "cancel" &&
    session.mode.kind === "explore" &&
    session.queue.length > 0
  )
    return { ...session, queue: session.queue.slice(0, -1) };
  const { mode, action } = transition(
    session.mode,
    command,
    session.game,
    targetedAt(session),
  );
  const moded = { ...session, mode };
  return action ? performed(moded, action) : moded;
};

export const update = (session: Session, message: Message): Session => {
  switch (message.kind) {
    case "cycleTarget": {
      const { game, range, target } = session;
      return { ...session, target: nextTarget(game, range, target) };
    }
    case "transfer":
    case "trade":
    case "take-all":
    case "prepare":
    case "destroy":
    case "learn":
      return performed(session, message);
    case "inventory":
      return { ...session, isInventoryOpen: true };
    case "dismiss":
      return { ...session, isInventoryOpen: false, conversant: undefined };
    case "view":
      return { ...session, range: message.range };
    case "speed":
      return { ...session, speed: message.speed, queue: [] };
    case "tick":
      return ticked(session);
    default:
      return commanded(session, message);
  }
};
