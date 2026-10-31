import type { Rejection } from "./actions/deeds";
import { creatureOf, facingAt } from "./archetypes";
import { has, type EntityId, type Position } from "./components";
import { inflicted } from "./conditions";
import type { ConditionId } from "./content/conditions";
import type { CreatureKind } from "./content/creatures";
import type { Who } from "./events";
import { hit } from "./health";
import {
  add,
  DIRECTIONS,
  directionBetween,
  flanksOf,
  neighborsOf,
  type Direction,
  type Hex,
} from "./hex";
import { waresOf } from "./items";
import {
  inserted,
  isInReach,
  occupantAt,
  recorded,
  sitesAround,
  updated,
  whoIs,
  withOf,
  type Game,
} from "./world";

/** Hexes an effect reaches, from its origin: itself, the hex aimed at, ahead, its flanks, or around the hex aimed at. */
export type Area = "self" | "target" | "ahead" | "flanks" | "ring";

/** The closed set of primitive state changes. Abilities and conditions compose them; add one only when no composition will do. */
export type Effect =
  | { readonly kind: "face" }
  | { readonly kind: "damage"; readonly area: Area; readonly amount: number }
  | {
      readonly kind: "restore";
      readonly stat: "hp" | "mp";
      readonly amount: number;
    }
  | {
      readonly kind: "condition";
      readonly area: Area;
      readonly condition: ConditionId;
      readonly turns: number;
    }
  | {
      readonly kind: "summon";
      readonly creature: CreatureKind;
      readonly count: number;
    }
  | {
      /** Tops wares up to `stock` items and gold up to `gold`. */
      readonly kind: "restock";
      readonly stock: number;
      readonly gold: number;
    };

export interface Context {
  /** Credited with the effect: who cast it, or who inflicted the condition. */
  readonly source: Who;
  /** Where areas are measured from, and who `restore`, `summon` and `restock` act on. */
  readonly origin: EntityId;
  readonly at?: Hex | undefined;
  /** Multiplies amounts, counts and turns, rounded down. */
  readonly mastery: number;
}

const MELEE_AREAS: ReadonlySet<Area> = new Set(["ahead", "flanks"]);

export const areaOf = (
  area: Area,
  { at: from, facing }: Position,
  at: Hex | undefined,
): readonly Hex[] => {
  const toward = (direction: Direction) => add(from, DIRECTIONS[direction]);
  switch (area) {
    case "self":
      return [from];
    case "target":
      return at ? [at] : [];
    case "ahead":
      return [toward(facing)];
    case "flanks":
      return flanksOf(facing).map(toward);
    case "ring":
      return at ? neighborsOf(at) : [];
  }
};

const hexesOf = (
  game: Game,
  area: Area,
  origin: Position,
  at: Hex | undefined,
): readonly Hex[] =>
  areaOf(area, origin, at).filter(
    (hex) => !MELEE_AREAS.has(area) || isInReach(game, origin.at, hex),
  );

const scaled = (amount: number, mastery: number) =>
  Math.floor(amount * mastery);

/** Why `effect` would do nothing, if it would. */
export const problemOf = (
  game: Game,
  effect: Effect,
  { origin, mastery }: Context,
): Rejection | undefined => {
  const entity = game.entities.get(origin);
  switch (effect.kind) {
    case "condition":
      return scaled(effect.turns, mastery) === 0 ? "unable" : undefined;
    case "summon":
      if (scaled(effect.count, mastery) === 0) return "unable";
      return entity?.at && sitesAround(game, entity.at).length > 0
        ? undefined
        : "blocked";
    case "restock":
      if (!entity || !has(entity, "wares", "purse")) return "unable";
      return entity.wares.length >= effect.stock && entity.gold >= effect.gold
        ? "full"
        : undefined;
    default:
      return undefined;
  }
};

const summoned = (
  game: Game,
  effect: Extract<Effect, { kind: "summon" }>,
  { origin, mastery, source }: Context,
): Game => {
  const caster = withOf(
    game,
    origin,
    "position",
    "membership",
    "mind",
    "stats",
  );
  if (!caster) return game;
  const sites = sitesAround(game, caster.at).slice(
    0,
    scaled(effect.count, mastery),
  );
  return recorded(
    sites.reduce(
      (state, at, i) =>
        inserted(
          state,
          creatureOf(effect.creature, {
            id: `${caster.id}/${game.turn}/${i}`,
            home: caster.home,
            at,
            facing: facingAt(game.land.seed, at, game.turn),
            level: caster.power,
            mind: caster.mind,
          }),
        ),
      game,
    ),
    {
      kind: "summoned",
      source,
      summoned: effect.creature,
      count: sites.length,
    },
  );
};

const restocked = (
  game: Game,
  { stock, gold }: Extract<Effect, { kind: "restock" }>,
  { origin, source }: Context,
): Game => {
  const trader = withOf(game, origin, "wares", "purse");
  if (!trader) return game;
  const missing = Math.max(0, stock - trader.wares.length);
  return recorded(
    updated(game, origin, {
      wares: [
        ...trader.wares,
        ...waresOf(game.land.seed, origin, game.turn, missing),
      ],
      gold: Math.max(trader.gold, gold),
    }),
    { kind: "restocked", source },
  );
};

const conditioned = (
  game: Game,
  { condition, turns }: Extract<Effect, { kind: "condition" }>,
  hex: Hex,
  { source, mastery }: Context,
): Game => {
  const target = occupantAt(game, hex);
  if (!target || !has(target, "conditions", "health") || target.hp <= 0)
    return game;
  const lasting = scaled(turns, mastery);
  const conditions = inflicted(target.conditions, condition, lasting, source);
  return recorded(updated(game, target.id, { conditions }), {
    kind: "conditioned",
    source,
    target: whoIs(game, target),
    condition,
    turns: lasting,
  });
};

const restored = (
  game: Game,
  { stat, amount }: Extract<Effect, { kind: "restore" }>,
  { origin, mastery }: Context,
): Game => {
  const entity = game.entities.get(origin);
  if (stat === "hp" && entity && has(entity, "health"))
    return updated(game, origin, {
      hp: Math.min(entity.maxHp, entity.hp + amount * mastery),
    });
  if (stat === "mp" && entity && has(entity, "mana"))
    return updated(game, origin, {
      mp: Math.min(entity.maxMp, entity.mp + amount * mastery),
    });
  return game;
};

export const applied = (game: Game, effect: Effect, context: Context): Game => {
  const origin = withOf(game, context.origin, "position");
  if (!origin) return game;
  const { at, source, mastery } = context;
  switch (effect.kind) {
    case "face": {
      const facing = at && directionBetween(origin.at, at);
      return facing ? updated(game, origin.id, { facing }) : game;
    }
    case "damage":
      return hexesOf(game, effect.area, origin, at).reduce(
        (state, hex) => hit(state, source, hex, effect.amount * mastery),
        game,
      );
    case "condition":
      return hexesOf(game, effect.area, origin, at).reduce(
        (state, hex) => conditioned(state, effect, hex, context),
        game,
      );
    case "restore":
      return restored(game, effect, context);
    case "summon":
      return summoned(game, effect, context);
    case "restock":
      return restocked(game, effect, context);
  }
};
