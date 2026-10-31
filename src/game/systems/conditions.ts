import { rngOf } from "procgen";
import type { EntityId } from "../components";
import { begun, recovered } from "../conditions";
import { conditionOf } from "../content/conditions";
import { applied } from "../effects";
import { caused, recorded, updated, whoIs, withOf, type Game } from "../world";

/** Start of an entity's turn: its conditions are suffered a turn longer, and those due apply their effects, credited to whoever inflicted them. */
export const suffering = (game: Game, id: EntityId): Game => {
  const bearer = withOf(game, id, "conditions");
  if (!bearer || bearer.conditions.size === 0) return game;
  const { conditions, due } = begun(bearer.conditions);
  return due.reduce(
    (state, [condition, { source }]) =>
      caused(state, { kind: "condition", condition }, (suffered) =>
        conditionOf(condition).every!.effects.reduce(
          (next, effect) =>
            applied(next, effect, { source, origin: id, mastery: 1 }),
          suffered,
        ),
      ),
    updated(game, id, { conditions }),
  );
};

/** End of an entity's turn: its timed conditions run down, and may be shaken off. */
export const recovering = (game: Game, id: EntityId): Game => {
  const bearer = withOf(game, id, "conditions");
  if (!bearer) return game;
  const rng = rngOf(game.land.seed, "shake off").child(id);
  const { kept, lost } = recovered(bearer.conditions, (condition, chance) =>
    rng.child(condition).chance(chance, game.turn),
  );
  if (kept === bearer.conditions) return game;
  const source = whoIs(game, bearer);
  return lost.reduce(
    (state, condition) =>
      recorded(state, {
        kind: "recovered",
        source,
        condition,
        cause: { kind: "condition", condition },
      }),
    updated(game, id, { conditions: kept }),
  );
};
