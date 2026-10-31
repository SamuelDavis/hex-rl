import { expect, test } from "vitest";
import { DEFAULT_THEME, themeOf } from "./theme";

test("a stored theme is restored", () => {
  expect(themeOf(JSON.stringify("classic"))).toBe("classic");
});

test("an unknown stored theme falls back to the default", () => {
  expect(themeOf(JSON.stringify("vaporwave"))).toBe(DEFAULT_THEME);
  expect(themeOf("{}")).toBe(DEFAULT_THEME);
});
