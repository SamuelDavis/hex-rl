import type {
  Action,
  Cargo,
  GameEvent,
  Rejection,
  Where,
} from "../../game/game";
import { nameOf, type Item } from "../../game/items";
import { SPAWNERS } from "../../game/monsters";

const REASONS: Record<Rejection, string> = {
  blocked: "the way is blocked",
  over: "dead",
  "not-ready": "not ready",
  "no-mana": "not enough mana",
  "no-target": "no target",
  "out-of-reach": "out of reach",
  "out-of-range": "out of range",
  "out-of-sight": "out of sight",
  misfit: "it doesn't go there",
  "no-item": "there is nothing to move",
  full: "the pack is full",
  "no-chest": "there is no chest here",
};

const VERBS: Record<Exclude<Action["kind"], "cast">, string> = {
  move: "move",
  attack: "attack",
  wait: "wait",
  transfer: "move that",
  prepare: "prepare",
  quaff: "quaff",
  destroy: "destroy",
};

const verbOf = (action: Action) =>
  action.kind === "cast" ? `cast ${action.spell}` : VERBS[action.kind];

const PLAYER = "The adventurer";

const cargoNameOf = (cargo: Cargo) =>
  cargo.kind === "gold" ? `${cargo.amount} gold` : `the ${nameOf(cargo)}`;

const listOf = (items: readonly Item[]) => {
  const names = items.map((item) => `The ${nameOf(item)}`);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)!.toLowerCase()}`
    : names[0];
};

const movingOf = (from: Where, to: Where) => {
  if (to === "ground") return "puts down";
  if (to !== "pack") return "equips";
  return from === "ground" ? "takes" : "takes off";
};

export const narrationOf = (event: GameEvent): string => {
  switch (event.kind) {
    case "began":
      return `${PLAYER} sets out into the wilds.`;
    case "rejected":
      return `${PLAYER} cannot ${verbOf(event.action)}: ${REASONS[event.reason]}.`;
    case "cast":
      return `${PLAYER} casts ${event.spell}.`;
    case "hitMonster":
      return `${PLAYER} hits the ${event.monster}.`;
    case "killed":
      return `${PLAYER} kills the ${event.monster}.`;
    case "dropped":
      return `The ${event.monster} drops a chest.`;
    case "moved":
      return `${PLAYER} ${movingOf(event.from, event.to)} ${cargoNameOf(event.cargo)}.`;
    case "spilled":
      return `${listOf(event.items)} ${event.items.length > 1 ? "spill" : "spills"} from the pack.`;
    case "prepared":
      return `${PLAYER} prepares themselves.`;
    case "destroyed":
      return `${PLAYER} destroys the chest.`;
    case "quaffed":
      return `${PLAYER} quaffs a ${event.potion} potion.`;
    case "hitSpawner":
      return `${PLAYER} hits the ${SPAWNERS[event.spawner].name}.`;
    case "wrecked":
      return `${PLAYER} wrecks the ${SPAWNERS[event.spawner].name}.`;
    case "emerged":
      return `The ${event.monster} emerges!`;
    case "struck":
      return `The ${event.monster} hits ${PLAYER.toLowerCase()}.`;
    case "died":
      return `${PLAYER} dies.`;
  }
};
