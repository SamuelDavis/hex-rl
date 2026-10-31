import { findPath, rngOf } from "procgen";
import { triggeredOf } from "../actions/abilities";
import type { Intent, Plan } from "../actions/deeds";
import { planOf } from "../actions/pipeline";
import { spawnerOf } from "../content/creatures";
import { relationOf } from "../content/factions";
import {
  centerOf,
  DIRECTIONS,
  directionBetween,
  hexDistance,
  hexKey,
  neighborsOf,
  type Direction,
  type Hex,
} from "../hex";
import { sighted, tetherOf, unsighted, type Mind } from "../mind";
import { canNotice, SIGHT } from "../sight";
import {
  entitiesWith,
  isBeside,
  isBlocked,
  isInReach,
  type Creature,
  type Game,
} from "../world";

export const HUNT_RADIUS = 4;
const WANDER_CHANCE = 0.3;
const PATH_BUDGET = 200;

interface Leash {
  readonly center: Hex;
  readonly radius: number;
}

const leashOf = ({ home, mind }: Creature): Leash => ({
  center: tetherOf(mind, home.at),
  radius: spawnerOf(home.kind).leash,
});

const isWithin = (hex: Hex, { center, radius }: Leash) =>
  hexDistance(hex, center) <= radius;

const stepToward = (
  game: Game,
  creature: Creature,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const route = findPath({
    start: creature.at,
    isGoal: (hex) => hexDistance(hex, goal) <= reach,
    neighbors: (hex) =>
      neighborsOf(hex).filter(
        (next) => isInReach(game, hex, next) && !isBlocked(game, next),
      ),
    cost: () => 1,
    heuristic: (hex) => Math.max(0, hexDistance(hex, goal) - reach),
    keyOf: hexKey,
    maxExpansions: PATH_BUDGET,
  });
  return "path" in route ? route.path[1] : undefined;
};

const alignment = (from: Hex, to: Hex, heading: Direction | undefined) => {
  if (!heading) return 1;
  const step = centerOf({ q: to.q - from.q, r: to.r - from.r });
  const ahead = centerOf(DIRECTIONS[heading]);
  const dot =
    (step.x * ahead.x + step.y * ahead.y) / (step.x * step.x + step.y * step.y);
  return (1 + dot) * (1 + dot) + 0.1;
};

const wander = (
  game: Game,
  creature: Creature,
  area: Leash,
  chance: number,
  heading?: Direction,
): Hex | undefined => {
  const { at, id } = creature;
  const rng = rngOf(game.land.seed, "wander").child(id);
  if (!rng.chance(chance, game.turn)) return undefined;
  const options = neighborsOf(at)
    .filter(
      (next) =>
        isWithin(next, area) &&
        isWithin(next, leashOf(creature)) &&
        isInReach(game, at, next) &&
        !isBlocked(game, next),
    )
    .map((next) => [next, alignment(at, next, heading)] as const);
  if (options.length === 0) return undefined;
  return rng.weighted(options, game.turn, 1);
};

/** Standing agents hostile to `creature`. */
const foesOf = (game: Game, creature: Creature) =>
  entitiesWith(game, "agent", "position", "health", "allegiance").filter(
    ({ faction, hp, id }) =>
      id !== creature.id &&
      hp > 0 &&
      relationOf(faction, creature.faction) === "hostile",
  );

/** Notices the nearest foe it can, else loses track. */
export const mindOf = (game: Game, creature: Creature): Mind => {
  const { at, facing, mind } = creature;
  const distanceOf = (foe: { readonly at: Hex }) => hexDistance(foe.at, at);
  const quarry = foesOf(game, creature)
    .filter(
      (foe) =>
        distanceOf(foe) <= SIGHT &&
        canNotice(game.land.tileAt, at, facing, foe.at),
    )
    .sort((a, b) => distanceOf(a) - distanceOf(b))[0];
  return quarry ? sighted(mind, at, quarry) : unsighted(mind, at);
};

const approach = (
  game: Game,
  creature: Creature,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const step = stepToward(game, creature, goal, reach);
  return step && isWithin(step, leashOf(creature)) ? step : undefined;
};

const destinationOf = (game: Game, creature: Creature): Hex | undefined => {
  const { mind, at, home } = creature;
  switch (mind.state) {
    case "idle": {
      const leash = leashOf(creature);
      return isWithin(at, leash)
        ? wander(game, creature, leash, WANDER_CHANCE)
        : stepToward(game, creature, home.at, leash.radius);
    }
    case "hostile":
      return approach(
        game,
        creature,
        mind.lastSeen,
        isBlocked(game, mind.lastSeen) ? 1 : 0,
      );
    case "hunting": {
      const area = { center: mind.lastSeen, radius: HUNT_RADIUS };
      return isWithin(at, area)
        ? wander(game, creature, area, 1, mind.heading)
        : approach(game, creature, mind.lastSeen, HUNT_RADIUS);
    }
  }
};

const toward = ({ at }: Creature, to: Hex | undefined): Intent => {
  const direction = to && directionBetween(at, to);
  return direction ? { kind: "move", direction } : { kind: "wait" };
};

/** Idle, it stands still beside a friendly seat to deal with them. */
const isAttending = (game: Game, creature: Creature): boolean =>
  creature.mind.state === "idle" &&
  entitiesWith(game, "agent", "position", "allegiance").some(
    ({ controller, at, faction }) =>
      controller === "seat" &&
      relationOf(faction, creature.faction) === "friendly" &&
      isBeside(game, creature.at, at),
  );

const choiceOf = (game: Game, creature: Creature): Intent => {
  const { mind } = creature;
  if (mind.state === "hostile" && isBeside(game, creature.at, mind.lastSeen))
    return toward(creature, mind.lastSeen);
  if (isAttending(game, creature)) return { kind: "wait" };
  return toward(creature, destinationOf(game, creature));
};

/** Its first ability triggered by its state, attempted before its move, which it falls back to. */
export const planFor = (game: Game, creature: Creature): Plan => {
  const plan = planOf(creature, choiceOf(game, creature));
  const { state } = creature.mind;
  const triggered =
    state === "hunting" ? [] : triggeredOf(game, creature, state);
  const ability = triggered[0];
  return ability
    ? {
        attempt: { kind: "use", ability },
        otherwise: { blocked: plan, full: plan },
      }
    : plan;
};
