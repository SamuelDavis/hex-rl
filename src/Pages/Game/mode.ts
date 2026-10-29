import { aimed, startAim } from "./aim";
import { unreadinessOf, type Action, type Game } from "../../game/game";
import type { Direction, Hex } from "../../game/hex";
import { SPELLS, type SpellId } from "../../game/spells";

export interface Aiming {
  readonly kind: "aim";
  readonly spell: SpellId;
  readonly range: number;
  readonly at: Hex;
}

export type Mode = { readonly kind: "explore" } | Aiming;

export const EXPLORE: Mode = { kind: "explore" };

export type Command =
  | { readonly kind: "move"; readonly direction: Direction }
  | { readonly kind: "wait" }
  | { readonly kind: "use"; readonly spell: SpellId }
  | { readonly kind: "confirm" }
  | { readonly kind: "cancel" };

export interface Transition {
  readonly mode: Mode;
  readonly action?: Action;
}

const released = ({ spell, at }: Aiming): Transition => ({
  mode: EXPLORE,
  action: { kind: "cast", spell, at },
});

const chosen = (
  game: Game,
  spell: SpellId,
  target: Hex | undefined,
): Transition => {
  const { aim } = SPELLS[spell];
  if (aim.kind !== "hex" || unreadinessOf(game, spell))
    return { mode: EXPLORE, action: { kind: "cast", spell, at: target } };
  const at = startAim(game, aim.range, target);
  return { mode: { kind: "aim", spell, range: aim.range, at } };
};

const explore = (
  command: Command,
  game: Game,
  target: Hex | undefined,
): Transition => {
  switch (command.kind) {
    case "move":
      return {
        mode: EXPLORE,
        action: { kind: "move", direction: command.direction },
      };
    case "wait":
      return { mode: EXPLORE, action: { kind: "wait" } };
    case "use":
      return chosen(game, command.spell, target);
    case "confirm":
    case "cancel":
      return { mode: EXPLORE };
  }
};

const aim = (
  mode: Aiming,
  command: Command,
  game: Game,
  target: Hex | undefined,
): Transition => {
  switch (command.kind) {
    case "move":
      return {
        mode: {
          ...mode,
          at: aimed(game, mode.range, mode.at, command.direction),
        },
      };
    case "wait":
      return { mode };
    case "use":
      return command.spell === mode.spell
        ? released(mode)
        : chosen(game, command.spell, target);
    case "confirm":
      return released(mode);
    case "cancel":
      return { mode: EXPLORE };
  }
};

export const transition = (
  mode: Mode,
  command: Command,
  game: Game,
  target?: Hex,
): Transition => {
  switch (mode.kind) {
    case "explore":
      return explore(command, game, target);
    case "aim":
      return aim(mode, command, game, target);
  }
};
