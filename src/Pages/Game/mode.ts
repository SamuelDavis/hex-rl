import { aimed, startAim } from "./aim";
import { unreadinessOf, type Intent, type Game } from "../../game/game";
import type { Direction, Hex } from "../../game/hex";
import { abilityOf, type AbilityId } from "../../game/abilities";

/** Reach of `interact`: an adjacent hex. */
export const INTERACT_RANGE = 1;

/** What an aim releases, once given its hex. */
export type Aimed =
  | { readonly kind: "use"; readonly ability: AbilityId }
  | { readonly kind: "interact" };

export interface Aiming {
  readonly kind: "aim";
  readonly aimed: Aimed;
  readonly range: number;
  readonly at: Hex;
}

export type Mode = { readonly kind: "explore" } | Aiming;

export const EXPLORE: Mode = { kind: "explore" };

export type Command =
  | { readonly kind: "move"; readonly direction: Direction }
  | { readonly kind: "wait" }
  | { readonly kind: "use"; readonly ability: AbilityId }
  | { readonly kind: "interact" }
  | { readonly kind: "confirm" }
  | { readonly kind: "cancel" };

export interface Transition {
  readonly mode: Mode;
  readonly action?: Intent;
}

const released = ({ aimed, at }: Aiming): Transition => ({
  mode: EXPLORE,
  action: { ...aimed, at },
});

const aiming = (
  game: Game,
  aimed: Aimed,
  range: number,
  target: Hex | undefined,
): Transition => ({
  mode: { kind: "aim", aimed, range, at: startAim(game, range, target) },
});

const chosen = (
  game: Game,
  ability: AbilityId,
  target: Hex | undefined,
): Transition => {
  const { aim } = abilityOf(ability);
  if (aim.kind !== "hex" || unreadinessOf(game, ability))
    return { mode: EXPLORE, action: { kind: "use", ability, at: target } };
  return aiming(game, { kind: "use", ability }, aim.range, target);
};

const INTERACTING: Aimed = { kind: "interact" };

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
    case "interact":
      return aiming(game, INTERACTING, INTERACT_RANGE, target);
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
    case "use": {
      const { aimed } = mode;
      if (aimed.kind === "use" && command.ability === aimed.ability)
        return released(mode);
      if (!abilityOf(command.ability).spendsTurn)
        return { mode, action: { kind: "use", ability: command.ability } };
      return chosen(game, command.ability, target);
    }
    case "interact":
      return mode.aimed.kind === "interact"
        ? released(mode)
        : aiming(game, INTERACTING, INTERACT_RANGE, target);
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
