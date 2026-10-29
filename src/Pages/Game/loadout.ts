import { isAbility, type AbilityId } from "../../game/abilities";
import type { Input } from "./controls";
import type { Message } from "./session";

export const SLOT_COUNT = 6;

export type Loadout = readonly (AbilityId | undefined)[];

const fitted = (abilities: readonly (AbilityId | undefined)[]): Loadout =>
  Array.from({ length: SLOT_COUNT }, (_, slot) => abilities[slot]);

export const STARTING_LOADOUT: Loadout = fitted([
  "cleave",
  "fireball",
  "heal",
  "strike",
]);

export const slotted = (
  loadout: Loadout,
  slot: number,
  ability: AbilityId | undefined,
): Loadout => loadout.map((bound, at) => (at === slot ? ability : bound));

export const decodeLoadout = (json: string): Loadout => {
  const stored: unknown = JSON.parse(json);
  if (!Array.isArray(stored)) return STARTING_LOADOUT;
  return fitted(stored.map((entry) => (isAbility(entry) ? entry : undefined)));
};

export const messageOf = (loadout: Loadout, input: Input): Message | undefined => {
  if (input.kind !== "slot") return input;
  const ability = loadout[input.slot];
  return ability && { kind: "use", ability };
};
