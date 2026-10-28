import {
  act,
  newGame,
  type Action,
  type Bind,
  type Destroy,
  type Game,
  type GameEvent,
  type Transfer,
} from "./game";
import { isPotion } from "./items";
import { hexKey, sameHex, type Hex } from "./hex";
import { EXPLORE, transition, type Command, type Mode } from "./mode";
import { nextTarget, targetInView, tracked, type Target } from "./target";
import { createTerrain } from "./terrain";

export const LOG_LENGTH = 50;

/** Everything one player's run holds, whatever drives it: tests, GUI or TUI. */
export interface Session {
  readonly game: Game;
  readonly mode: Mode;
  readonly target: Target | undefined;
  /** Opens on stepping onto a chest; once dismissed, stays shut until the next step. */
  readonly isInventoryOpen: boolean;
  /** How far, in hexes, the view shows; targets beyond it can't be chosen. */
  readonly range: number;
  readonly log: readonly GameEvent[];
}

export type Intent =
  | Exclude<Command, { readonly kind: "slot" }>
  | { readonly kind: "slot"; readonly slot: number }
  | { readonly kind: "cycleTarget" }
  | { readonly kind: "inventory" }
  | { readonly kind: "dismiss" }
  | Transfer
  | Bind
  | Destroy
  | { readonly kind: "view"; readonly range: number };

export const sessionOf = (game: Game, range: number): Session => ({
  game,
  mode: EXPLORE,
  target: undefined,
  isInventoryOpen: false,
  range,
  log: game.events,
});

export const newSession = (seed: number, range: number): Session =>
  sessionOf(newGame(createTerrain(seed)), range);

export const targetedAt = ({ game, range, target }: Session): Hex | undefined =>
  target && targetInView(game, range, target)?.at;

const performed = (session: Session, action: Action): Session => {
  const { range, target, log } = session;
  const game = act(session.game, action);
  const hasStepped = !sameHex(game.player.at, session.game.player.at);
  return {
    ...session,
    game,
    isInventoryOpen: hasStepped
      ? game.chests.has(hexKey(game.player.at))
      : session.isInventoryOpen,
    target: target && tracked(game, range, target),
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

export const update = (session: Session, intent: Intent): Session => {
  switch (intent.kind) {
    case "slot": {
      const ability = session.game.player.loadout[intent.slot];
      if (!ability) return session;
      return isPotion(ability)
        ? performed(session, { kind: "quaff", potion: ability })
        : commanded(session, { kind: "slot", spell: ability });
    }
    case "cycleTarget": {
      const { game, range, target } = session;
      return { ...session, target: nextTarget(game, range, target) };
    }
    case "transfer":
    case "bind":
    case "destroy":
      return performed(session, intent);
    case "inventory":
      return { ...session, isInventoryOpen: true };
    case "dismiss":
      return { ...session, isInventoryOpen: false };
    case "view":
      return { ...session, range: intent.range };
    default:
      return commanded(session, intent);
  }
};
