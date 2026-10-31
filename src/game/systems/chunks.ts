import { cellKey, grid, type Bounds, type Cell } from "procgen";
import { spawnerEntityOf, spawnerIdOf } from "../archetypes";
import { clearingOf, isSettlement } from "../content/settlements";
import { reshaped } from "../settlements";
import { centerOf, type Hex } from "../hex";
import { CHUNK, type Spawner } from "../terrain";
import { entitiesWith, inserted, type Game } from "../world";

/** Chunks from each seat's, in every direction, whose entities are processed. `SIMULATION_RADIUS × CHUNK` spans more than `SIGHT` hexes, so nothing a seat sees is frozen. */
export const SIMULATION_RADIUS = 2;

const CHUNKS = grid(CHUNK);

const chunkOf = (hex: Hex): Cell => CHUNKS.cellOf(centerOf(hex));

/** Keys of the chunks within `SIMULATION_RADIUS` of any seat. */
export type Active = ReadonlySet<string>;

const activeCellsOf = (game: Game): readonly Cell[] =>
  entitiesWith(game, "agent", "position")
    .filter(({ controller }) => controller === "seat")
    .flatMap(({ at }) => CHUNKS.cellsAround(chunkOf(at), SIMULATION_RADIUS));

export const activeOf = (game: Game): Active =>
  new Set(activeCellsOf(game).map(cellKey));

export const isActive = (active: Active, hex: Hex): boolean =>
  active.has(cellKey(chunkOf(hex)));

const activeBoundsOf = (game: Game): readonly Bounds[] => [
  ...new Map(
    activeCellsOf(game).map((cell) => [cellKey(cell), CHUNKS.boundsOf(cell)]),
  ).values(),
];

/** Adds `spawner`; a settlement reshapes the ground around it. */
const placed = (game: Game, spawner: Spawner): Game => {
  const added = inserted(game, spawnerEntityOf(spawner));
  return isSettlement(spawner.kind)
    ? reshaped(added, spawner.at, clearingOf(spawner.kind))
    : added;
};

/** Adds the spawners of newly active chunks; once added, they persist like any entity. */
export const materialised = (game: Game): Game => {
  const active = activeOf(game);
  return activeBoundsOf(game)
    .flatMap((bounds) => game.land.spawnersIn(bounds))
    .filter(({ at }) => isActive(active, at))
    .reduce(
      (state, spawner) =>
        state.entities.has(spawnerIdOf(spawner.at))
          ? state
          : placed(state, spawner),
      game,
    );
};
