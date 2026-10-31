import { abilityOf, type AbilityId } from "../../game/abilities";
import type { Direction } from "../../game/hex";
import {
  PLAYER,
  type Intent,
  type ActorKind,
  type Cargo,
  type GameEvent,
  type Rejection,
  type Where,
} from "../../game/game";
import { nameOf, type Item } from "../../game/items";
import {
  bossOf,
  SPAWNERS,
  type Affliction,
  type SpawnerKind,
} from "../../game/monsters";
import type { Hex } from "../../game/hex";

const REASONS: Record<Rejection, string> = {
  blocked: "the way is blocked",
  occupied: "something is in the way",
  "not-facing": "not facing that way",
  "already-facing": "already facing that way",
  over: "dead",
  "not-ready": "not ready",
  "no-mana": "not enough mana",
  "no-target": "no target",
  "out-of-reach": "out of reach",
  "out-of-range": "out of range",
  "out-of-sight": "out of sight",
  misfit: "it doesn't go there",
  "no-item": "there is none",
  full: "the pack is full",
  "no-chest": "there is no chest here",
  unlearned: "not learned",
  "no-unlocks": "no level to spend",
  stunned: "stunned",
  paralyzed: "paralyzed",
  friendly: "they are a friend",
  uninterested: "they have nothing to offer",
  "no-gold": "not enough gold",
  unable: "unable",
};

const VERBS: Record<Exclude<Intent["kind"], "use">, string> = {
  move: "move",
  turn: "turn",
  step: "step",
  attack: "attack",
  wait: "wait",
  transfer: "move that",
  "take-all": "take anything",
  prepare: "prepare",
  destroy: "destroy",
  learn: "learn",
  summon: "summon",
  restock: "restock",
  interact: "interact",
  trade: "trade that",
};

const usingOf = (ability: AbilityId, verbs: readonly [string, string]) =>
  abilityOf(ability).consumes
    ? `${verbs[0]} a ${ability} potion`
    : `${verbs[1]} ${ability}`;

const verbOf = (action: Intent) =>
  action.kind === "use"
    ? usingOf(action.ability, ["quaff", "cast"])
    : VERBS[action.kind];

const PLAYER_NAME = "The adventurer";

const actorNameOf = (actor: ActorKind) =>
  actor === PLAYER ? PLAYER_NAME : `The ${actor}`;

const DIRECTION_NAMES: Record<Direction, string> = {
  nw: "north-west",
  n: "north",
  ne: "north-east",
  sw: "south-west",
  s: "south",
  se: "south-east",
};

const AFFLICTION_VERBS: Record<Affliction, string> = {
  bleed: "bleeds",
  stun: "is stunned",
  paralysis: "is paralyzed",
};

const counted = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

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

export const placeOf = ({ q, r }: Hex) => `(${q}, ${r})`;

/** What a bounty asks: "slay the alpha wolf of the wolf den at (6, 0)". */
export const bountyOf = (spawner: SpawnerKind, at: Hex) =>
  `slay the ${bossOf(spawner)} of the ${SPAWNERS[spawner].name} at ${placeOf(at)}`;

export const narrationOf = (event: GameEvent): string => {
  switch (event.kind) {
    case "began":
      return `${PLAYER_NAME} sets out into the wilds.`;
    case "rejected":
      return `${actorNameOf(event.actor)} cannot ${verbOf(event.action)}: ${REASONS[event.reason]}.`;
    case "turned":
      return `${actorNameOf(event.actor)} turns ${DIRECTION_NAMES[event.facing]}.`;
    case "stepped":
      return `${actorNameOf(event.actor)} steps ${DIRECTION_NAMES[event.direction]}.`;
    case "used":
      return `${PLAYER_NAME} ${usingOf(event.ability, ["quaffs", "casts"])}.`;
    case "hitMonster":
      return `${actorNameOf(event.actor)} hits the ${event.monster}.`;
    case "killed":
      return `${actorNameOf(event.actor)} kills the ${event.monster}.`;
    case "dropped":
      return `The ${event.monster} drops a chest.`;
    case "moved":
      return `${PLAYER_NAME} ${movingOf(event.from, event.to)} ${cargoNameOf(event.cargo)}.`;
    case "spilled":
      return `${listOf(event.items)} ${event.items.length > 1 ? "spill" : "spills"} from the pack.`;
    case "prepared":
      return `${PLAYER_NAME} prepares themselves.`;
    case "destroyed":
      return `${PLAYER_NAME} destroys the chest.`;
    case "hitSpawner":
      return `${PLAYER_NAME} hits the ${SPAWNERS[event.spawner].name}.`;
    case "wrecked":
      return `${PLAYER_NAME} wrecks the ${SPAWNERS[event.spawner].name}.`;
    case "emerged":
      return `The ${event.monster} emerges!`;
    case "struck":
      return `The ${event.monster} hits ${PLAYER_NAME.toLowerCase()}.`;
    case "leveled":
      return `${PLAYER_NAME} reaches level ${event.level}.`;
    case "learned":
      return `${PLAYER_NAME} learns ${event.spell} (level ${event.level}).`;
    case "summoned":
      return `The ${event.monster} summons ${counted(event.count, event.summoned)}.`;
    case "afflicted":
      return `${PLAYER_NAME} ${AFFLICTION_VERBS[event.affliction]} for ${counted(event.turns, "turn")}.`;
    case "bled":
      return `${PLAYER_NAME} bleeds.`;
    case "died":
      return `${PLAYER_NAME} dies.`;
    case "restocked":
      return `The ${event.monster} restocks their wares.`;
    case "interacted":
      return `${PLAYER_NAME} hails the ${event.monster}.`;
    case "bought":
      return `${PLAYER_NAME} buys the ${nameOf(event.item)} for ${event.price} gold.`;
    case "sold":
      return `${PLAYER_NAME} sells the ${nameOf(event.item)} for ${event.price} gold.`;
    case "bountied":
      return `The bailiff posts a bounty: ${bountyOf(event.spawner, event.at)}.`;
    case "bountySlain":
      return `${PLAYER_NAME} slays the bounty; a bailiff will pay.`;
    case "rewarded":
      return `The bailiff pays ${PLAYER_NAME.toLowerCase()} ${event.gold} gold.`;
  }
};
