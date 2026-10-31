import type { Intent } from "../actions/deeds";
import { planOf, settled } from "../actions/pipeline";
import { has, type Entity, type EntityId } from "../components";
import { isStanding } from "../health";
import { caused, updated, withOf, type Creature, type Game } from "../world";
import { activeOf, isActive, type Active } from "./chunks";
import { recovering, suffering } from "./conditions";
import { mindOf, planFor } from "./minds";
import { spawning } from "./spawning";

type Intents = ReadonlyMap<EntityId, Intent>;

/** One phase of an entity's turn; each acts only on entities with the components it needs. */
type Phase = (game: Game, id: EntityId, intents: Intents) => Game;

const acting: Phase = (game, id, intents) => {
  const agent = withOf(game, id, "agent", "health");
  if (!agent || !isStanding(agent)) return game;
  if (has(agent, "mind")) {
    const creature = agent as Creature;
    const mind = mindOf(game, creature);
    const minded = updated(game, id, { mind });
    return settled(minded, id, planFor(minded, { ...creature, mind })).game;
  }
  const intent = intents.get(id);
  return intent ? settled(game, id, planOf(agent, intent)).game : game;
};

const spawningPhase: Phase = (game, id) =>
  caused(game, { kind: "system", system: "spawning" }, (state) =>
    spawning(state, id),
  );

/** An entity's turn, in order: the single list of per-entity behaviour. */
const TURN: readonly Phase[] = [suffering, acting, spawningPhase, recovering];

const isTakingTurns = (entity: Entity, active: Active): boolean =>
  has(entity, "position") &&
  isActive(active, entity.at) &&
  (!has(entity, "health") || isStanding(entity));

/** The next entity to take its turn after `cursor` in spawn order, among those spawned by `last`. */
const nextOf = (
  game: Game,
  cursor: number,
  last: number,
  active: Active,
): Entity | undefined => {
  for (const entity of game.entities.values())
    if (
      entity.seq > cursor &&
      entity.seq <= last &&
      isTakingTurns(entity, active)
    )
      return entity;
  return undefined;
};

/** Every active, standing entity takes its turn once, in spawn order: seats act on `intents` (absent: pass), minds by choice. The cursor re-reads the current state each step, so the slain are skipped and the newly spawned wait for the next tick. */
export const turns = (game: Game, intents: Intents): Game => {
  const active = activeOf(game);
  const last = game.seq;
  let state = game;
  for (
    let entity = nextOf(state, 0, last, active);
    entity;
    entity = nextOf(state, entity.seq, last, active)
  ) {
    const { id } = entity;
    state = TURN.reduce((turned, phase) => phase(turned, id, intents), state);
  }
  return state;
};
