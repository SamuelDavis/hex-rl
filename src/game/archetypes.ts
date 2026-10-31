/** Which components each kind of entity is built with: the only place content archetypes become entities. */
import { rngOf } from "procgen";
import { PLAYER, type Entity } from "./components";
import { permanent } from "./conditions";
import { PLAYER_DAMAGE } from "./content/abilities";
import {
  CREATURES,
  KNACKS,
  SERVICES,
  spawnerHpOf,
  spawnerOf,
  type CreatureKind,
} from "./content/creatures";
import { isSettlement } from "./content/settlements";
import type { Who } from "./events";
import { HEADINGS, hexKey, type Direction, type Hex } from "./hex";
import { IDLE, type Mind } from "./mind";
import type { Spawner } from "./terrain";

export const MAX_HP = 20;
export const MAX_MP = 10;

type Unplaced = Omit<Entity, "seq">;

const PLAYER_WHO: Who = { id: PLAYER, kind: PLAYER, faction: "town" };

export const playerAt = (at: Hex): Unplaced => ({
  id: PLAYER,
  kind: PLAYER,
  at,
  facing: "n",
  hp: MAX_HP,
  maxHp: MAX_HP,
  onDepleted: "fall",
  mp: MAX_MP,
  maxMp: MAX_MP,
  conditions: permanent(PLAYER_WHO, "regeneration", "mana regeneration"),
  faction: "town",
  controller: "seat",
  abilities: new Map(),
  readyAt: new Map(),
  damage: PLAYER_DAMAGE,
  power: 1,
  pack: [],
  equipment: {},
  gold: 0,
  xp: 0,
  kills: 0,
  bounty: undefined,
  bountyLevel: 0,
});

export const facingAt = (seed: number, at: Hex, turn: number): Direction =>
  rngOf(seed, "spawns").pick(HEADINGS, at.q, at.r, turn, 2);

export interface Placement {
  readonly id: string;
  readonly home: Spawner;
  readonly at: Hex;
  readonly facing: Direction;
  readonly level: number;
  readonly mind?: Mind;
}

export const creatureOf = (
  kind: CreatureKind,
  { id, home, at, facing, level, mind = IDLE }: Placement,
): Unplaced => {
  const { hp, damage } = CREATURES[kind];
  const knacks = KNACKS[kind] ?? [];
  return {
    id,
    kind,
    at,
    facing,
    hp,
    maxHp: hp,
    onDepleted: "perish",
    conditions: new Map(),
    faction: spawnerOf(home.kind).faction,
    controller: "mind",
    mind,
    home,
    abilities: new Map(knacks.map((knack) => [knack, level])),
    readyAt: new Map(),
    damage,
    power: level,
    ...(SERVICES[kind] === "trade" && { wares: [], gold: 0 }),
  };
};

export const spawnerIdOf = (at: Hex): string => `spawner:${hexKey(at)}`;

export const spawnerEntityOf = ({ kind, at }: Spawner): Unplaced => {
  const { faction } = spawnerOf(kind);
  const hp = spawnerHpOf(kind);
  const id = spawnerIdOf(at);
  return {
    id,
    kind,
    at,
    facing: "n",
    hp,
    maxHp: hp,
    onDepleted: "wreck",
    conditions: permanent({ id, kind, faction }, "regeneration"),
    faction,
    controller: "mind",
    spawnsAt: 0,
    isWrecked: false,
    isBossDue: false,
    ...(isSettlement(kind) && { townLevel: 1 }),
  };
};

export const outpostOf = (outpost: Spawner, liege: Hex): Unplaced => ({
  ...spawnerEntityOf(outpost),
  liege,
});
