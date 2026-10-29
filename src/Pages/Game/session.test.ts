import { describe, expect, test } from "vitest";
import { EXPLORE } from "./mode";
import {
  LOG_LENGTH,
  newSession,
  sessionOf,
  targetedAt,
  update,
  type Intent,
  type Session,
} from "./session";
import { east, gameWith, monster } from "../../game/testing";
import { hexKey } from "../../game/hex";
import type { Game } from "../../game/game";

const RANGE = 5;
const near = { q: 3, r: 0 };
const run = (session: Session, ...intents: Intent[]) =>
  intents.reduce(update, session);
const targeting = (...at: { q: number; r: number }[]) =>
  run(sessionOf(gameWith(at.map((hex) => monster(hex, "troll"))), RANGE), {
    kind: "cycleTarget",
  });

describe("newSession", () => {
  test("is seeded, exploring, and logs the start", () => {
    const session = newSession(7, RANGE);
    expect(session.game.land.seed).toBe(7);
    expect(session.mode).toEqual(EXPLORE);
    expect(session.log).toEqual([{ kind: "began" }]);
  });
});

describe("update", () => {
  test("logs each action's events", () => {
    const session = run(targeting(east), { kind: "move", direction: "se" });
    expect(session.log).toContainEqual({
      kind: "hitMonster",
      monster: "troll",
    });
  });

  test("keeps only the latest log entries", () => {
    const waits = Array.from<Intent>({ length: LOG_LENGTH }).fill({
      kind: "wait",
    });
    const game = gameWith([]);
    const dead = sessionOf({ ...game, player: { ...game.player, hp: 0 } }, 1);
    const session = run(dead, ...waits, ...waits);
    expect(session.log).toHaveLength(LOG_LENGTH);
  });

  test("cycles targets, even while aiming", () => {
    const session = run(
      targeting(east, near),
      { kind: "use", ability: "fireball" },
      { kind: "cycleTarget" },
    );
    expect(session.mode.kind).toBe("aim");
    expect(targetedAt(session)).toEqual(near);
  });

  test("aims, steers and casts a hex-aimed spell at the reticle", () => {
    const session = run(
      targeting(near),
      { kind: "use", ability: "fireball" },
      { kind: "move", direction: "nw" },
      { kind: "confirm" },
    );
    expect(session.mode).toEqual(EXPLORE);
    expect(session.game.turn).toBe(1);
    expect(session.log).toContainEqual({ kind: "used", ability: "fireball" });
  });

  test("cancelling an aim spends no turn", () => {
    const session = run(
      targeting(near),
      { kind: "use", ability: "fireball" },
      { kind: "cancel" },
    );
    expect(session.mode).toEqual(EXPLORE);
    expect(session.game.turn).toBe(0);
  });

  test("casts monster-aimed spells at the target", () => {
    const session = run(targeting(east), {
      kind: "use",
      ability: "strike",
    });
    expect(session.log).toContainEqual({ kind: "used", ability: "strike" });
  });

  test("drops the target once it is out of range", () => {
    const session = run(
      { ...targeting(east), range: 0 },
      { kind: "move", direction: "se" },
    );
    expect(session.target).toBeUndefined();
  });

  test("preparing spends a turn", () => {
    const session = run(targeting(east), { kind: "prepare" });
    expect(session.game.turn).toBe(1);
    expect(session.log).toContainEqual({ kind: "prepared" });
  });

  test("using a potion quaffs it at once, even while aiming, spending no turn", () => {
    const base = targeting(near);
    const game: Game = {
      ...base.game,
      player: {
        ...base.game.player,
        mp: 7,
        pack: [{ id: "m", kind: "potion", potion: "mana" }],
      },
    };
    const session = run(
      { ...base, game },
      { kind: "prepare" },
      { kind: "use", ability: "fireball" },
      { kind: "use", ability: "mana" },
    );
    expect(session.mode.kind).toBe("aim");
    expect(session.game.turn).toBe(1);
    expect(session.log).toContainEqual({ kind: "used", ability: "mana" });
  });

  test("resizing the view changes the target range", () => {
    expect(run(targeting(), { kind: "view", range: 2 }).range).toBe(2);
  });

  test("stepping onto a chest opens the inventory, which stays dismissed until stepping back on", () => {
    const base = sessionOf(gameWith([]), RANGE);
    const chest = { gold: 1, items: [] };
    const session = {
      ...base,
      game: { ...base.game, chests: new Map([[hexKey(east), chest]]) },
    };
    const step = (direction: "se" | "nw"): Intent => ({
      kind: "move",
      direction,
    });
    const onChest = run(session, step("se"));
    expect(onChest.isInventoryOpen).toBe(true);
    const dismissed = run(onChest, { kind: "dismiss" }, { kind: "wait" });
    expect(dismissed.isInventoryOpen).toBe(false);
    const back = run(dismissed, step("nw"), step("nw"), step("se"), step("se"));
    expect(back.game.player.at).toEqual(east);
    expect(back.isInventoryOpen).toBe(true);
  });

  test("the inventory opens anywhere on request", () => {
    const session = run(sessionOf(gameWith([]), RANGE), { kind: "inventory" });
    expect(session.isInventoryOpen).toBe(true);
  });
});
