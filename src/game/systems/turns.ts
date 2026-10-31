import type { Intent } from "../actions/deeds";
import { planOf, settled } from "../actions/pipeline";
import { has, type Entity, type EntityId } from "../components";
import { isStanding } from "../health";
import { withOf, type Game } from "../world";
import { activeOf, isActive, type Active } from "./chunks";
import { recovering, suffering } from "./conditions";
import { minded } from "./minds";

type Intents = ReadonlyMap<EntityId, Intent>;

/** One phase of an entity's turn; each acts only on entities with the components it needs. */
type Phase = (game: Game, id: EntityId, intents: Intents) => Game;

const acting: Phase = (game, id, intents) => {
  const agent = withOf(game, id, "agent", "health");
  if (!agent || !isStanding(agent)) return game;
  if (agent.controller === "seat") {
    const intent = intents.get(id);
    return intent ? settled(game, id, planOf(agent, intent)).game : game;
  }
  const choice = minded(game, agent);
  return settled(choice.game, id, choice.plan).game;
};

/** An entity's turn, in order: the single list of per-entity behaviour. */
const TURN: readonly Phase[] = [suffering, acting, recovering];

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
