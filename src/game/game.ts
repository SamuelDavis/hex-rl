/** The game's public interface: the UI imports from here only. Architecture: docs/architecture.md. */
export { act, immediate, newGame, tick } from "./tick";
export {
  creaturesOf,
  isOver,
  playerOf,
  spawnersOf,
  whoOf,
  type Creature,
  type Game,
  type Land,
  type Player,
} from "./world";
export {
  PLAYER,
  has,
  type Entity,
  type EntityId,
  type With,
} from "./components";
export type { GameEvent, Who, Cause } from "./events";
export {
  GOLD,
  type Destroy,
  type Intent,
  type Learn,
  type Prepare,
  type Rejection,
  type TakeAll,
  type Trade,
  type Transfer,
} from "./actions/deeds";
export type { Cargo, Where } from "./actions/inventory";
export { cooldownOf, unreadinessOf } from "./actions/abilities";
export { MAX_HP, MAX_MP, spawnerIdOf } from "./archetypes";
export { remainingOf } from "./conditions";
export {
  levelOf,
  masteryOf,
  spellLevelOf,
  unlocksOf,
  XP_PER_LEVEL,
} from "./progression";
export { BOUNTY_GOLD_PER_LEVEL } from "./quests";
export { isWrecked } from "./actions/spawning";
export { visibleOf } from "./systems/vision";
export { HUNT_RADIUS } from "./systems/minds";
