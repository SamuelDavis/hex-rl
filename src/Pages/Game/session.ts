import {
  act,
  newGame,
  type Action,
  type Destroy,
  type Game,
  type GameEvent,
  type Prepare,
  type Transfer,
} from "../../game/game";
import { isPotion } from "../../game/items";
import type { Ability } from "./loadout";
import { hexKey, sameHex, type Hex } from "../../game/hex";
import { EXPLORE, transition, type Command, type Mode } from "./mode";
import { nextTarget, targetInView, tracked, type Target } from "./target";
import { createTerrain } from "../../game/terrain";

export const LOG_LENGTH = 50;

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
  | Exclude<Command, { readonly kind: "use" }>
  | { readonly kind: "use"; readonly ability: Ability }
  | { readonly kind: "cycleTarget" }
  | { readonly kind: "inventory" }
  | { readonly kind: "dismiss" }
  | Transfer
  | Prepare
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
    case "use":
      return isPotion(intent.ability)
        ? performed(session, { kind: "quaff", potion: intent.ability })
        : commanded(session, { kind: "use", spell: intent.ability });
    case "cycleTarget": {
      const { game, range, target } = session;
      return { ...session, target: nextTarget(game, range, target) };
    }
    case "transfer":
    case "prepare":
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
