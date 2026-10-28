import { describe, expect, test } from "vitest";
import { EXPLORE } from "./mode";
import {
  LOG_LENGTH,
  newSession,
  sessionOf,
  STARTING_LOADOUT,
  targetedAt,
  update,
  type Intent,
  type Session,
} from "./session";
import { east, gameWith, monster } from "./testing";

const RANGE = 5;
const near = { q: 3, r: 0 };
const run = (session: Session, ...intents: Intent[]) =>
  intents.reduce(update, session);
const slotOf = (spell: string) =>
  STARTING_LOADOUT.findIndex((equipped) => equipped === spell);
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
      { kind: "slot", slot: slotOf("fireball") },
      { kind: "cycleTarget" },
    );
    expect(session.mode.kind).toBe("aim");
    expect(targetedAt(session)).toEqual(near);
  });

  test("aims, steers and casts a hex-aimed spell at the reticle", () => {
    const session = run(
      targeting(near),
      { kind: "slot", slot: slotOf("fireball") },
      { kind: "move", direction: "nw" },
      { kind: "confirm" },
    );
    expect(session.mode).toEqual(EXPLORE);
    expect(session.game.turn).toBe(1);
    expect(session.log).toContainEqual({ kind: "cast", spell: "fireball" });
  });

  test("cancelling an aim spends no turn", () => {
    const session = run(
      targeting(near),
      { kind: "slot", slot: slotOf("fireball") },
      { kind: "cancel" },
    );
    expect(session.mode).toEqual(EXPLORE);
    expect(session.game.turn).toBe(0);
  });

  test("casts monster-aimed spells at the target", () => {
    const session = run(targeting(east), {
      kind: "slot",
      slot: slotOf("strike"),
    });
    expect(session.log).toContainEqual({ kind: "cast", spell: "strike" });
  });

  test("drops the target once it is out of range", () => {
    const session = run(
      { ...targeting(east), range: 0 },
      { kind: "move", direction: "se" },
    );
    expect(session.target).toBeUndefined();
  });

  test("an empty slot does nothing", () => {
    const session = run(
      targeting(east),
      { kind: "equip", slot: 0, spell: undefined },
      { kind: "slot", slot: 0 },
    );
    expect(session.loadout[0]).toBeUndefined();
    expect(session.game.turn).toBe(0);
  });

  test("resizing the view changes the target range", () => {
    expect(run(targeting(), { kind: "view", range: 2 }).range).toBe(2);
  });
});
