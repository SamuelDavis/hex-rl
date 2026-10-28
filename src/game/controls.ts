import type { Direction } from "./hex";
import { SLOT_COUNT, type Intent } from "./session";

export type ControlId =
  | `move-${Direction}`
  | "wait"
  | "target"
  | "confirm"
  | "cancel"
  | `slot-${number}`;

export interface Control {
  readonly id: ControlId;
  readonly label: string;
  readonly intent: Intent;
}

/** Control → lowercase `KeyboardEvent.key`; one key per control. */
export type Keymap = Readonly<Record<ControlId, string>>;

const MOVES: readonly (readonly [Direction, string, string])[] = [
  ["nw", "north-west", "q"],
  ["n", "north", "w"],
  ["ne", "north-east", "e"],
  ["sw", "south-west", "a"],
  ["s", "south", "s"],
  ["se", "south-east", "d"],
];

const SLOTS = Array.from({ length: SLOT_COUNT }, (_, slot) => slot);

const BINDINGS: readonly (readonly [Control, string])[] = [
  ...MOVES.map(
    ([direction, name, key]) =>
      [
        {
          id: `move-${direction}`,
          label: `Move ${name}`,
          intent: { kind: "move", direction },
        },
        key,
      ] as const,
  ),
  [{ id: "wait", label: "Wait", intent: { kind: "wait" } }, " "],
  [
    { id: "target", label: "Next target", intent: { kind: "cycleTarget" } },
    "t",
  ],
  [
    { id: "confirm", label: "Cast aimed", intent: { kind: "confirm" } },
    "enter",
  ],
  [{ id: "cancel", label: "Cancel aim", intent: { kind: "cancel" } }, "escape"],
  ...SLOTS.map(
    (slot) =>
      [
        {
          id: `slot-${slot + 1}`,
          label: `Cast slot ${slot + 1}`,
          intent: { kind: "slot", slot },
        },
        String(slot + 1),
      ] as const,
  ),
];

export const CONTROLS: readonly Control[] = BINDINGS.map(
  ([control]) => control,
);

export const DEFAULT_KEYMAP = Object.fromEntries(
  BINDINGS.map(([{ id }, key]) => [id, key]),
) as Keymap;

export const CONTROL_BY_ID = Object.fromEntries(
  CONTROLS.map((control) => [control.id, control]),
) as Readonly<Record<ControlId, Control>>;

const controlOf = (keymap: Keymap, key: string) =>
  CONTROLS.find(({ id }) => keymap[id] === key.toLowerCase());

export const intentOf = (keymap: Keymap, key: string): Intent | undefined =>
  controlOf(keymap, key)?.intent;

export const rebound = (keymap: Keymap, id: ControlId, key: string): Keymap => {
  const displaced = controlOf(keymap, key);
  const swapped = displaced ? { [displaced.id]: keymap[id] } : {};
  return { ...keymap, ...swapped, [id]: key.toLowerCase() };
};

const KEY_LABELS: Readonly<Record<string, string>> = {
  " ": "Space",
  escape: "Esc",
};

export const keyLabelOf = (key: string): string =>
  KEY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
