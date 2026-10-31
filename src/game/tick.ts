import type { Intent } from "./actions/deeds";
import { planOf, settled } from "./actions/pipeline";
import { playerAt } from "./archetypes";
import { PLAYER, type EntityId } from "./components";
import type { SystemId } from "./events";
import type { Hex } from "./hex";
import { turns } from "./systems/turns";
import { materialised } from "./systems/chunks";
import { vision } from "./systems/vision";
import {
  caused,
  emptyGame,
  inserted,
  isOver,
  playerOf,
  recorded,
  whoIs,
  type Game,
  type Land,
} from "./world";

type System = (game: Game) => Game;

/** World-level upkeep after every entity has taken its turn, in order. Per-entity behaviour is `TURN` (`systems/turns.ts`). */
const UPKEEP: readonly (readonly [SystemId, System])[] = [
  ["chunks", materialised],
  ["vision", vision],
];

/** One world turn: every active entity takes its turn, then upkeep, then the turn advances. Its events are this tick's alone. What drives ticks is the caller's: docs/time.md. */
export const tick = (
  game: Game,
  intents: ReadonlyMap<EntityId, Intent>,
): Game => {
  const kept = UPKEEP.reduce(
    (state, [system, run]) => caused(state, { kind: "system", system }, run),
    turns({ ...game, events: [] }, intents),
  );
  return { ...kept, turn: kept.turn + 1 };
};

/** The player's Intent resolved at once if it can be: a free Deed, or a rejection. `undefined` when it would spend a turn, so must wait for a tick. */
export const immediate = (game: Game, intent: Intent): Game | undefined => {
  const fresh = { ...game, events: [] };
  const player = playerOf(fresh);
  if (isOver(fresh))
    return recorded(fresh, {
      kind: "rejected",
      source: whoIs(fresh, player),
      action: intent,
      reason: "over",
    });
  const { game: next, spendsTurn } = settled(
    fresh,
    PLAYER,
    planOf(player, intent),
  );
  return spendsTurn ? undefined : next;
};

/** Turn-based: the player's Intent resolves at once, or runs the tick it spends. */
export const act = (game: Game, intent: Intent): Game =>
  immediate(game, intent) ?? tick(game, new Map([[PLAYER, intent]]));

/** The player starts at `start`, the spawn by default; danger is still measured from the spawn. */
export const newGame = (land: Land, start: Hex = land.spawn): Game => {
  const placed = inserted(emptyGame(land), playerAt(start));
  const began = recorded(placed, {
    kind: "began",
    source: whoIs(placed, playerOf(placed)),
  });
  return vision(materialised(began));
};
