import { isPotion, type PotionKind } from "../../game/items";
import { SPELL_IDS, type SpellId } from "../../game/spells";
import type { Input } from "./controls";
import type { Intent } from "./session";

export const SLOT_COUNT = 6;

export type Ability = SpellId | PotionKind;

export type Loadout = readonly (Ability | undefined)[];

const isAbility = (value: unknown): value is Ability =>
  typeof value === "string" &&
  ((SPELL_IDS as readonly string[]).includes(value) || isPotion(value));

const fitted = (abilities: readonly (Ability | undefined)[]): Loadout =>
  Array.from({ length: SLOT_COUNT }, (_, slot) => abilities[slot]);

export const STARTING_LOADOUT: Loadout = fitted(SPELL_IDS);

export const slotted = (
  loadout: Loadout,
  slot: number,
  ability: Ability | undefined,
): Loadout => loadout.map((bound, at) => (at === slot ? ability : bound));

export const decodeLoadout = (json: string): Loadout => {
  const stored: unknown = JSON.parse(json);
  if (!Array.isArray(stored)) return STARTING_LOADOUT;
  return fitted(stored.map((entry) => (isAbility(entry) ? entry : undefined)));
};

export const intentOf = (loadout: Loadout, input: Input): Intent | undefined => {
  if (input.kind !== "slot") return input;
  const ability = loadout[input.slot];
  return ability && { kind: "use", ability };
};
