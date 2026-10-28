import type { Action, GameEvent, Rejection } from "./game";
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
};

const verbOf = (action: Action) => {
  if (typeof action === "object") return `cast ${action.spell}`;
  return action === "wait" ? "wait" : "move";
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
