import { expect, test } from "vitest";
import { screenRadiusOf } from "./draw";

test("the screen radius is how many hexes fit from the player to the nearest edge", () => {
  expect(screenRadiusOf({ width: 486, height: 486 })).toBe(8);
  expect(screenRadiusOf({ width: 300, height: 486 })).toBe(5);
});
