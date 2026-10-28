import { act, newGame, type Action, type Game, type GameEvent } from "./game";
import type { Hex } from "./hex";
import { EXPLORE, transition, type Command, type Mode } from "./mode";
import { SPELL_IDS, type SpellId } from "./spells";
import { nextTarget, targetInView, tracked, type Target } from "./target";
import { createTerrain } from "./terrain";

export const SLOT_COUNT = 6;
export const LOG_LENGTH = 50;

export type Loadout = readonly (SpellId | undefined)[];

export const STARTING_LOADOUT: Loadout = Array.from(
  { length: SLOT_COUNT },
  (_, slot) => SPELL_IDS[slot],
);

/** Everything one player's run holds, whatever drives it: tests, GUI or TUI. */
export interface Session {
  readonly game: Game;
  readonly mode: Mode;
  readonly target: Target | undefined;
  readonly loadout: Loadout;
  /** How far, in hexes, the view shows; targets beyond it can't be chosen. */
  readonly range: number;
  readonly log: readonly GameEvent[];
}

export type Intent =
  | Exclude<Command, { readonly kind: "slot" }>
  | { readonly kind: "slot"; readonly slot: number }
  | { readonly kind: "cycleTarget" }
  | {
      readonly kind: "equip";
      readonly slot: number;
      readonly spell: SpellId | undefined;
    }
  | { readonly kind: "view"; readonly range: number };

export const sessionOf = (game: Game, range: number): Session => ({
  game,
  mode: EXPLORE,
  target: undefined,
  loadout: STARTING_LOADOUT,
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
  return {
    ...session,
    game,
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
      const spell = session.loadout[intent.slot];
      return spell ? commanded(session, { kind: "slot", spell }) : session;
    }
    case "cycleTarget": {
      const { game, range, target } = session;
      return { ...session, target: nextTarget(game, range, target) };
    }
    case "equip": {
      const loadout = session.loadout.map((equipped, slot) =>
        slot === intent.slot ? intent.spell : equipped,
      );
      return { ...session, loadout };
    }
    case "view":
      return { ...session, range: intent.range };
    default:
      return commanded(session, intent);
  }
};
