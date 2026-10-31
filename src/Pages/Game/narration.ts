import { abilityOf, type AbilityId } from "../../game/abilities";
import type { Direction } from "../../game/hex";
import {
  PLAYER,
  type Intent,
  type Cargo,
  type GameEvent,
  type Rejection,
  type Where,
  type Who,
} from "../../game/game";
import { nameOf, type Item } from "../../game/items";
import { bossOf, SPAWNERS, type SpawnerKind } from "../../game/creatures";
import type { Hex } from "../../game/hex";
import type { Affliction } from "../../game/afflictions";
import { Biome } from "../../game/terrain";

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

const DIRECTION_NAMES: Record<Direction, string> = {
  nw: "north-west",
  n: "north",
  ne: "north-east",
  sw: "south-west",
  s: "south",
  se: "south-east",
};

const AFFLICTION_NOUNS: Record<Affliction, string> = {
  bleed: "bleeding",
  stun: "the stun",
  paralysis: "paralysis",
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

const TOWN_STYLES: Record<Biome, string> = {
  [Biome.Ocean]: "coastal",
  [Biome.Beach]: "coastal",
  [Biome.Desert]: "desert",
  [Biome.Plains]: "meadow",
  [Biome.Forest]: "forest",
  [Biome.Taiga]: "pinewood",
  [Biome.Tundra]: "tundra",
  [Biome.Mountain]: "mountain",
  [Biome.Peak]: "highland",
  [Biome.Marsh]: "fen",
};

/** "adventurer"; townsfolk take their town's biome, "coastal reeve"; monsters are their kind. */
export const whoNameOf = ({ kind, faction, biome }: Who): string => {
  if (kind === PLAYER) return "adventurer";
  return faction === "town" && biome !== undefined
    ? `${TOWN_STYLES[biome]} ${kind}`
    : kind;
};

/** "the coastal reeve" */
const the = (who: Who) => `the ${whoNameOf(who)}`;

/** "The coastal reeve", to open a sentence. */
const The = (who: Who) => `The ${whoNameOf(who)}`;

export const placeOf = ({ q, r }: Hex) => `(${q}, ${r})`;

/** What a bounty asks: "slay the alpha wolf of the wolf den at (6, 0)". */
export const bountyOf = (spawner: SpawnerKind, at: Hex) =>
  `slay the ${bossOf(spawner)} of the ${SPAWNERS[spawner].name} at ${placeOf(at)}`;

export const narrationOf = (event: GameEvent): string => {
  const actor = The(event.actor);
  switch (event.kind) {
    case "began":
      return `${actor} sets out into the wilds.`;
    case "rejected":
      return `${actor} cannot ${verbOf(event.action)}: ${REASONS[event.reason]}.`;
    case "turned":
      return `${actor} turns ${DIRECTION_NAMES[event.facing]}.`;
    case "stepped":
      return `${actor} steps ${DIRECTION_NAMES[event.direction]}.`;
    case "used":
      return `${actor} ${usingOf(event.ability, ["quaffs", "casts"])}.`;
    case "hit":
      return `${actor} hits ${the(event.target)}.`;
    case "killed":
      return `${actor} kills ${the(event.target)}.`;
    case "dropped":
      return `${actor} drops a chest.`;
    case "moved":
      return `${actor} ${movingOf(event.from, event.to)} ${cargoNameOf(event.cargo)}.`;
    case "spilled":
      return `${listOf(event.items)} ${event.items.length > 1 ? "spill" : "spills"} from ${the(event.actor)}'s pack.`;
    case "prepared":
      return `${actor} prepares themselves.`;
    case "destroyed":
      return `${actor} destroys the chest.`;
    case "hitSpawner":
      return `${actor} hits the ${SPAWNERS[event.spawner].name}.`;
    case "wrecked":
      return `${actor} wrecks the ${SPAWNERS[event.spawner].name}.`;
    case "emerged":
      return `${actor} emerges!`;
    case "leveled":
      return `${actor} reaches level ${event.level}.`;
    case "learned":
      return `${actor} learns ${event.spell} (level ${event.level}).`;
    case "summoned":
      return `${actor} summons ${counted(event.count, event.summoned)}.`;
    case "afflicted":
      return `${The(event.target)} ${AFFLICTION_VERBS[event.affliction]} for up to ${counted(event.turns, "turn")}.`;
    case "bled":
      return `${actor} bleeds.`;
    case "struggled":
      return `${actor} struggles against ${AFFLICTION_NOUNS[event.affliction]}.`;
    case "recovered":
      return `${actor} shakes off ${AFFLICTION_NOUNS[event.affliction]}.`;
    case "died":
      return `${actor} dies.`;
    case "restocked":
      return `${actor} restocks their wares.`;
    case "interacted":
      return `${actor} hails ${the(event.target)}.`;
    case "bought":
      return `${actor} buys the ${nameOf(event.item)} from ${the(event.target)} for ${event.price} gold.`;
    case "sold":
      return `${actor} sells the ${nameOf(event.item)} to ${the(event.target)} for ${event.price} gold.`;
    case "bountied":
      return `${actor} posts a bounty: ${bountyOf(event.spawner, event.at)}.`;
    case "bountySlain":
      return `${actor} slays ${the(event.target)}; a bailiff will pay.`;
    case "rewarded":
      return `${actor} pays ${the(event.target)} ${event.gold} gold.`;
  }
};
