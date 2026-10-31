import type { AbilityId } from "./content/abilities";
import type { ConditionId } from "./content/conditions";
import type { CreatureKind, SpawnerKind } from "./content/creatures";
import type { FactionId } from "./content/factions";
import type { Who } from "./events";
import type { Direction, Hex } from "./hex";
import type { Equipment, Item } from "./items";
import type { Mind } from "./mind";
import type { Spawner } from "./terrain";

export const PLAYER = "player";

export type EntityId = string;

/** The archetype an entity was built from (`archetypes.ts`); content, never branched on by engine code. */
export type Kind = typeof PLAYER | CreatureKind | SpawnerKind;

export interface Identity {
  readonly id: EntityId;
  readonly kind: Kind;
  /** Spawn order, which is turn order. */
  readonly seq: number;
}

export interface Position {
  readonly at: Hex;
  readonly facing: Direction;
}

/** At 0 hit points: `perish` removes it, dropping loot; `fall` leaves it down; `wreck` stops its spawning until healed. */
export type Depletion = "perish" | "fall" | "wreck";

export interface Health {
  readonly hp: number;
  readonly maxHp: number;
  readonly onDepleted: Depletion;
}

export interface Mana {
  readonly mp: number;
  readonly maxMp: number;
}

export interface ConditionState {
  readonly since: number;
  /** The turn it wears off at the latest; permanent when absent. */
  readonly until?: number;
  /** Who applied it, credited with what it does. */
  readonly source: Who;
}

export interface Conditions {
  readonly conditions: ReadonlyMap<ConditionId, ConditionState>;
}

export interface Allegiance {
  readonly faction: FactionId;
}

/** Takes turns; a `seat` is a human's, given Intents, a `mind` chooses its own. */
export interface Agent {
  readonly controller: "seat" | "mind";
}

export interface Minded {
  readonly mind: Mind;
}

/** The spawner it belongs to: its leash, its kin, and whose boss it may be. */
export interface Membership {
  readonly home: Spawner;
}

export interface Caster {
  /** Level of each ability known; unknown abilities are absent. */
  readonly abilities: ReadonlyMap<AbilityId, number>;
  /** The turn each ability used is ready again. */
  readonly readyAt: ReadonlyMap<AbilityId, number>;
}

export interface Stats {
  readonly damage: number;
  /** Scales damage and experience granted linearly. */
  readonly power: number;
}

export interface Inventory {
  readonly pack: readonly Item[];
  readonly equipment: Equipment;
}

export interface Purse {
  readonly gold: number;
}

export interface Wares {
  readonly wares: readonly Item[];
}

export interface Progression {
  readonly xp: number;
  readonly kills: number;
}

/** A bailiff's charge: slay the boss of the lair at `at`, then return to any bailiff. */
export interface Bounty {
  readonly kind: SpawnerKind;
  readonly at: Hex;
  readonly level: number;
  readonly isSlain: boolean;
}

export interface Questing {
  readonly bounty: Bounty | undefined;
  /** Level of the last bounty claimed; each new one is posted at a higher level. */
  readonly bountyLevel: number;
}

export interface Spawning {
  readonly spawnsAt: number;
  /** Set when depleted; spawning stops until fully healed. */
  readonly isWrecked: boolean;
  /** Set when wrecked; the boss emerges once a hex beside it is free. */
  readonly isBossDue: boolean;
}

/** Every component by name. An entity has any subset; `With` and `has` select by these names. */
export interface Components {
  position: Position;
  health: Health;
  mana: Mana;
  conditions: Conditions;
  allegiance: Allegiance;
  agent: Agent;
  mind: Minded;
  membership: Membership;
  caster: Caster;
  stats: Stats;
  inventory: Inventory;
  purse: Purse;
  wares: Wares;
  progression: Progression;
  questing: Questing;
  spawning: Spawning;
}

export type ComponentName = keyof Components;

/** A field each component always has; its presence marks the component's. */
const MARKERS: { readonly [K in ComponentName]: keyof Components[K] } = {
  position: "at",
  health: "hp",
  mana: "mp",
  conditions: "conditions",
  allegiance: "faction",
  agent: "controller",
  mind: "mind",
  membership: "home",
  caster: "abilities",
  stats: "damage",
  inventory: "pack",
  purse: "gold",
  wares: "wares",
  progression: "xp",
  questing: "bountyLevel",
  spawning: "spawnsAt",
};

type Intersection<U> = (U extends unknown ? (u: U) => void : never) extends (
  i: infer I,
) => void
  ? I
  : never;

export type Fields = Intersection<Components[ComponentName]>;

export type Entity = Identity & Partial<Fields>;

export type With<K extends ComponentName> = Entity &
  Intersection<Components[K]>;

export const has = <K extends ComponentName>(
  entity: Entity,
  ...components: readonly K[]
): entity is With<K> =>
  components.every((component) => MARKERS[component] in entity);
