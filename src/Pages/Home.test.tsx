import { render, screen, fireEvent } from "@solidjs/testing-library";
import { expect, test } from "vitest";
import { AppStateProvider } from "../AppState";
import Home from "./Home";

test("increments count", () => {
  render(() => (
    <AppStateProvider>
      <Home />
    </AppStateProvider>
  ));
  const button = screen.getByRole("button", { name: "Count: 0" });
  fireEvent.click(button);
  expect(button.textContent).toBe("Count: 1");
});
