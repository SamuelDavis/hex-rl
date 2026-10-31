import type { Intent } from "../actions/deeds";
import { planOf, settled } from "../actions/pipeline";
import { has, type Entity, type EntityId } from "../components";
import { updated, type Creature, type Game } from "../world";
import { activeOf, isActive, type Active } from "./chunks";
import { mindOf, planFor } from "./minds";

/** The next standing, active agent after `cursor` in spawn order, among those spawned by `last`. */
const nextAgent = (
  game: Game,
  cursor: number,
  last: number,
  active: Active,
): Entity | undefined => {
  for (const entity of game.entities.values())
    if (
      entity.seq > cursor &&
      entity.seq <= last &&
      has(entity, "agent", "position", "health") &&
      entity.hp > 0 &&
      isActive(active, entity.at)
    )
      return entity;
  return undefined;
};

const mindTurn = (game: Game, creature: Creature): Game => {
  const mind = mindOf(game, creature);
  const minded = updated(game, creature.id, { mind });
  return settled(minded, creature.id, planFor(minded, { ...creature, mind }))
    .game;
};

const agentTurn = (
  game: Game,
  agent: Entity,
  intents: ReadonlyMap<EntityId, Intent>,
): Game => {
  if (has(agent, "mind")) return mindTurn(game, agent as Creature);
  const intent = intents.get(agent.id);
  return intent ? settled(game, agent.id, planOf(agent, intent)).game : game;
};

/** Every active agent takes its turn once, in spawn order: seats from `intents` (absent: pass), minds by choice. The cursor re-reads the current state at each step, so the slain are skipped and the newly spawned wait for the next tick. */
export const agents = (
  game: Game,
  intents: ReadonlyMap<EntityId, Intent>,
): Game => {
  const active = activeOf(game);
  const last = game.seq;
  let state = game;
  for (
    let agent = nextAgent(state, 0, last, active);
    agent;
    agent = nextAgent(state, agent.seq, last, active)
  )
    state = agentTurn(state, agent, intents);
  return state;
};
