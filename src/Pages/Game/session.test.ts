import { describe, expect, test } from "vitest";
import { EXPLORE } from "./mode";
import {
  conversantOf,
  LOG_LENGTH,
  newSession,
  sessionOf,
  targetedAt,
  update,
  type Message,
  type Session,
} from "./session";
import { ADVENTURER, creature, east, gameWith, who } from "../../game/testing";
import { hexDistance, hexKey } from "../../game/hex";
import { playerOf } from "../../game/game";
import { eventsOf, withPlayer } from "../../game/testing";

const RANGE = 5;
const near = { q: 3, r: 0 };
const run = (session: Session, ...messages: Message[]) =>
  messages.reduce(update, session);
const targeting = (...at: { q: number; r: number }[]) =>
  run(sessionOf(gameWith(at.map((hex) => creature(hex, "troll"))), RANGE), {
    kind: "cycleTarget",
  });

describe("newSession", () => {
  test("is seeded, exploring, and logs the start", () => {
    const session = newSession(7, RANGE);
    expect(session.game.land.seed).toBe(7);
    expect(session.mode).toEqual(EXPLORE);
    expect(session.log).toEqual([{ kind: "began", source: ADVENTURER }]);
  });
});

describe("newSession at a position", () => {
  test("starts on the hex asked for when it can be stood on, else the nearest that can", () => {
    const at = newSession(7, RANGE, { q: -85, r: 20 }).game;
    const tile = at.land.tileAt(playerOf(at).at);
    expect(tile.water).toBeUndefined();
    expect(tile.tree).toBe(false);
    expect(hexDistance(playerOf(at).at, { q: -85, r: 20 })).toBeLessThan(8);
    expect(at.land.spawn).toEqual(newSession(7, RANGE).game.land.spawn);
    const exact = playerOf(at).at;
    expect(playerOf(newSession(7, RANGE, exact).game).at).toEqual(exact);
  });

  test("starts at the spawn by default", () => {
    const { game } = newSession(7, RANGE);
    expect(playerOf(game).at).toEqual(game.land.spawn);
  });
});

describe("update", () => {
  test("logs each action's events", () => {
    const session = run(targeting(east), { kind: "move", direction: "se" });
    expect(eventsOf({ ...session.game, events: session.log })).toContainEqual({
      kind: "hurt",
      source: ADVENTURER,
      target: who(creature(east, "troll")),
      amount: 2,
    });
  });

  test("keeps only the latest log entries", () => {
    const waits = Array.from<Message>({ length: LOG_LENGTH }).fill({
      kind: "wait",
    });
    const dead = sessionOf(withPlayer(gameWith([]), { hp: 0 }), 1);
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
    expect(eventsOf({ ...session.game, events: session.log })).toContainEqual({
      kind: "used",
      source: ADVENTURER,
      ability: "fireball",
    });
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
    expect(eventsOf({ ...session.game, events: session.log })).toContainEqual({
      kind: "used",
      source: ADVENTURER,
      ability: "strike",
    });
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
    expect(eventsOf({ ...session.game, events: session.log })).toContainEqual({
      kind: "prepared",
      source: ADVENTURER,
    });
  });

  test("using a potion quaffs it at once, even while aiming, spending no turn", () => {
    const base = targeting(near);
    const game = withPlayer(base.game, {
      mp: 7,
      pack: [{ id: "m", kind: "potion", potion: "mana" }],
    });
    const session = run(
      { ...base, game },
      { kind: "prepare" },
      { kind: "use", ability: "fireball" },
      { kind: "use", ability: "mana" },
    );
    expect(session.mode.kind).toBe("aim");
    expect(session.game.turn).toBe(1);
    expect(eventsOf({ ...session.game, events: session.log })).toContainEqual({
      kind: "used",
      source: ADVENTURER,
      ability: "mana",
    });
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
    const step = (direction: "se" | "nw"): Message => ({
      kind: "move",
      direction,
    });
    const onChest = run(session, step("se"));
    expect(onChest.isInventoryOpen).toBe(true);
    const dismissed = run(onChest, { kind: "dismiss" }, { kind: "wait" });
    expect(dismissed.isInventoryOpen).toBe(false);
    const back = run(dismissed, step("nw"), step("nw"), step("se"), step("se"));
    expect(playerOf(back.game).at).toEqual(east);
    expect(back.isInventoryOpen).toBe(true);
  });

  test("the inventory opens anywhere on request", () => {
    const session = run(sessionOf(gameWith([]), RANGE), { kind: "inventory" });
    expect(session.isInventoryOpen).toBe(true);
  });
});

describe("interacting", () => {
  const town = { kind: "town", at: { q: -3, r: 0 } } as const;
  const npc = (kind: "reeve" | "peasant") => ({
    ...creature(east, kind, "nw", town),
    readyAt: new Map([["restock", Infinity]] as const),
  });
  const beside = (kind: "reeve" | "peasant") =>
    sessionOf(gameWith([npc(kind)]), RANGE);
  const bump: Message = { kind: "move", direction: "se" };

  test("bumping a friend targets them and opens their dialog", () => {
    const session = run(beside("reeve"), bump);
    expect(session.target?.id).toBe(npc("reeve").id);
    expect(conversantOf(session)?.kind).toBe("reeve");
  });

  test("a friend without a service is still targeted, but no dialog opens", () => {
    const session = run(beside("peasant"), bump);
    expect(session.target?.id).toBe(npc("peasant").id);
    expect(conversantOf(session)).toBeUndefined();
    expect(session.game.turn).toBe(0);
  });

  test("the interact button interacts with the target at once", () => {
    const session = run(
      beside("reeve"),
      { kind: "cycleTarget" },
      { kind: "interact" },
    );
    expect(conversantOf(session)?.kind).toBe("reeve");
    expect(session.game.turn).toBe(1);
  });

  test("dismissing or stepping away closes the dialog", () => {
    const open = run(beside("reeve"), bump);
    expect(conversantOf(run(open, { kind: "dismiss" }))).toBeUndefined();
    const away = run(
      open,
      { kind: "move", direction: "nw" },
      { kind: "move", direction: "nw" },
    );
    expect(conversantOf(away)).toBeUndefined();
  });
});
