import type { AbilityId } from "../../game/abilities";
import type { Input } from "./controls";
import type { Message } from "./session";

export const SLOT_COUNT = 6;

export type Loadout = readonly (AbilityId | undefined)[];

export const STARTING_LOADOUT: Loadout = Array.from(
  { length: SLOT_COUNT },
  () => undefined,
);

export const slotted = (
  loadout: Loadout,
  slot: number,
  ability: AbilityId | undefined,
): Loadout => loadout.map((bound, at) => (at === slot ? ability : bound));

export const messageOf = (loadout: Loadout, input: Input): Message | undefined => {
  if (input.kind !== "slot") return input;
  const ability = loadout[input.slot];
  return ability && { kind: "use", ability };
};
