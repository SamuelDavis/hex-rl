import {
  act,
  newGame,
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
  | { readonly kind: "view"; readonly range: number };

export const sessionOf = (game: Game, range: number): Session => ({
  game,
  mode: EXPLORE,
  target: undefined,
  isInventoryOpen: false,
  conversant: undefined,
  range,
  log: game.events,
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
  const creature = game.creatures.find(({ id }) => id === conversant);
  return creature && directionBetween(game.player.at, creature.at)
    ? creature
    : undefined;
};

/** Whom the player tried to interact with this action, whether or not they could. */
const addresseeOf = ({ events, creatures }: Game): Creature | undefined => {
  for (const event of events) {
    if (event.kind === "interacted")
      return creatures.find(({ id }) => id === event.target.id);
    if (event.kind === "rejected" && event.action.kind === "interact") {
      const { at } = event.action;
      return at && creatures.find((creature) => sameHex(creature.at, at));
    }
  }
  return undefined;
};

const performed = (session: Session, action: Intent): Session => {
  const { range, target, log } = session;
  const game = act(session.game, action);
  const hasStepped = game.events.some(
    (event) => event.kind === "stepped" && event.actor.id === PLAYER,
  );
  const interacted = game.events.find((event) => event.kind === "interacted");
  const addressee = addresseeOf(game);
  return {
    ...session,
    game,
    isInventoryOpen: hasStepped
      ? game.chests.has(hexKey(game.player.at))
      : session.isInventoryOpen,
    conversant:
      interacted?.target.id ?? (hasStepped ? undefined : session.conversant),
    target: addressee
      ? targetOf(game, addressee)
      : target && tracked(game, range, target),
    log: [...log, ...game.events].slice(-LOG_LENGTH),
  };
};

const commanded = (session: Session, command: Command): Session => {
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
    default:
      return commanded(session, message);
  }
};
