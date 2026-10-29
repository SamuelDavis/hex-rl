import { aimed, startAim } from "./aim";
import { unreadinessOf, type Intent, type Game } from "../../game/game";
import type { Direction, Hex } from "../../game/hex";
import { abilityOf, type AbilityId } from "../../game/abilities";

export interface Aiming {
  readonly kind: "aim";
  readonly ability: AbilityId;
  readonly range: number;
  readonly at: Hex;
}

export type Mode = { readonly kind: "explore" } | Aiming;

export const EXPLORE: Mode = { kind: "explore" };

export type Command =
  | { readonly kind: "move"; readonly direction: Direction }
  | { readonly kind: "wait" }
  | { readonly kind: "use"; readonly ability: AbilityId }
  | { readonly kind: "confirm" }
  | { readonly kind: "cancel" };

export interface Transition {
  readonly mode: Mode;
  readonly action?: Intent;
}

const released = ({ ability, at }: Aiming): Transition => ({
  mode: EXPLORE,
  action: { kind: "use", ability, at },
});

const chosen = (
  game: Game,
  ability: AbilityId,
  target: Hex | undefined,
): Transition => {
  const { aim } = abilityOf(ability);
  if (aim.kind !== "hex" || unreadinessOf(game, ability))
    return { mode: EXPLORE, action: { kind: "use", ability, at: target } };
  const at = startAim(game, aim.range, target);
  return { mode: { kind: "aim", ability, range: aim.range, at } };
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
      return chosen(game, command.ability, target);
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
      if (command.ability === mode.ability) return released(mode);
      if (!abilityOf(command.ability).spendsTurn)
        return { mode, action: { kind: "use", ability: command.ability } };
      return chosen(game, command.ability, target);
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
