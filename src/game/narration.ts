import type { Action, Cargo, GameEvent, Rejection, Where } from "./game";
import { nameOf, type Item } from "./items";
import { SPAWNERS } from "./monsters";

const REASONS: Record<Rejection, string> = {
  blocked: "the way is blocked",
  over: "you are dead",
  "not-ready": "not ready",
  "no-mana": "not enough mana",
  "no-target": "no target",
  "out-of-reach": "out of reach",
  "out-of-range": "out of range",
  "out-of-sight": "out of sight",
  misfit: "it doesn't go there",
  "no-item": "there is nothing to move",
  full: "your pack is full",
  "no-chest": "there is no chest here",
};

const verbOf = (action: Action) => {
  if (typeof action === "object") {
    if ("spell" in action) return `cast ${action.spell}`;
    return action.kind === "transfer" ? "move that" : "destroy";
  }
  return action === "wait" ? "wait" : "move";
};

const cargoNameOf = (cargo: Cargo) =>
  cargo.kind === "gold" ? `${cargo.amount} gold` : `the ${nameOf(cargo)}`;

const listOf = (items: readonly Item[]) => {
  const names = items.map((item) => `The ${nameOf(item)}`);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)!.toLowerCase()}`
    : names[0];
};

const movingOf = (from: Where, to: Where) => {
  if (to === "ground") return "put down";
  if (to !== "pack") return "equip";
  return from === "ground" ? "take" : "take off";
};

export const narrationOf = (event: GameEvent): string => {
  switch (event.kind) {
    case "began":
      return "You set out into the wilds.";
    case "rejected":
      return `Cannot ${verbOf(event.action)}: ${REASONS[event.reason]}.`;
    case "cast":
      return `You cast ${event.spell}.`;
    case "hitMonster":
      return `You hit the ${event.monster}.`;
    case "killed":
      return `You kill the ${event.monster}.`;
    case "dropped":
      return `The ${event.monster} drops a chest.`;
    case "moved":
      return `You ${movingOf(event.from, event.to)} ${cargoNameOf(event.cargo)}.`;
    case "spilled":
      return `${listOf(event.items)} ${event.items.length > 1 ? "spill" : "spills"} from your pack.`;
    case "destroyed":
      return "You destroy the chest.";
    case "hitSpawner":
      return `You hit the ${SPAWNERS[event.spawner].name}.`;
    case "wrecked":
      return `You wreck the ${SPAWNERS[event.spawner].name}.`;
    case "emerged":
      return `The ${event.monster} emerges!`;
    case "struck":
      return `The ${event.monster} hits you.`;
    case "died":
      return "You die.";
  }
};
