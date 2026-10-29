import { describe, expect, test } from "vitest";
import {
  CONTROLS,
  DEFAULT_KEYMAP,
  inputOf,
  keyLabelOf,
  rebound,
} from "./controls";

describe("DEFAULT_KEYMAP", () => {
  test("binds every control to a distinct key", () => {
    const keys = CONTROLS.map(({ id }) => DEFAULT_KEYMAP[id]);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("inputOf", () => {
  test("finds the bound control's intent, case-insensitively", () => {
    expect(inputOf(DEFAULT_KEYMAP, "W")).toEqual({
      kind: "move",
      direction: "n",
    });
    expect(inputOf(DEFAULT_KEYMAP, " ")).toEqual({ kind: "wait" });
    expect(inputOf(DEFAULT_KEYMAP, "1")).toEqual({ kind: "slot", slot: 0 });
  });

  test("ignores unbound keys", () => {
    expect(inputOf(DEFAULT_KEYMAP, "z")).toBeUndefined();
  });
});

describe("rebound", () => {
  test("binds a free key to the control", () => {
    const keymap = rebound(DEFAULT_KEYMAP, "wait", "z");
    expect(inputOf(keymap, "z")).toEqual({ kind: "wait" });
    expect(inputOf(keymap, " ")).toBeUndefined();
  });

  test("swaps with the control already bound to the key", () => {
    const keymap = rebound(DEFAULT_KEYMAP, "wait", "t");
    expect(keymap.wait).toBe("t");
    expect(keymap.target).toBe(" ");
  });
});

describe("keyLabelOf", () => {
  test("names whitespace and special keys, capitalizes the rest", () => {
    expect(keyLabelOf(" ")).toBe("Space");
    expect(keyLabelOf("escape")).toBe("Esc");
    expect(keyLabelOf("enter")).toBe("Enter");
    expect(keyLabelOf("q")).toBe("Q");
  });
});
