import { rngOf } from "procgen";
import type { With } from "../components";
import { dueOf, recovered } from "../conditions";
import { conditionOf } from "../content/conditions";
import { applied } from "../effects";
import { isStanding } from "../health";
import { caused, recorded, updated, whoIs, withOf, type Game } from "../world";
import { activeOf, isActive } from "./chunks";

type Bearer = With<"conditions" | "health" | "position">;

const bearerOf = (game: Game, id: string): Bearer | undefined => {
  const bearer = withOf(game, id, "conditions", "health", "position");
  return bearer && isStanding(bearer) ? bearer : undefined;
};

/** Applies the `every` effects of each condition due, crediting whoever inflicted it. */
const suffered = (game: Game, bearer: Bearer): Game =>
  dueOf(bearer.conditions, game.turn).reduce(
    (state, [id, { source }]) =>
      bearerOf(state, bearer.id)
        ? caused(state, { kind: "condition", condition: id }, (suffering) =>
            conditionOf(id).every!.effects.reduce(
              (next, effect) =>
                applied(next, effect, {
                  source,
                  origin: bearer.id,
                  mastery: 1,
                }),
              suffering,
            ),
          )
        : state,
    game,
  );

/** Drops what wore off or was shaken off this turn. */
const recovering = (game: Game, bearer: Bearer): Game => {
  const rng = rngOf(game.land.seed, "shake off").child(bearer.id);
  const { kept, lost } = recovered(bearer.conditions, game.turn, (id, chance) =>
    rng.child(id).chance(chance, game.turn),
  );
  if (lost.length === 0) return game;
  const source = whoIs(game, bearer);
  return lost.reduce(
    (state, condition) =>
      recorded(state, {
        kind: "recovered",
        source,
        condition,
        cause: { kind: "condition", condition },
      }),
    updated(game, bearer.id, { conditions: kept }),
  );
};

/** Each active bearer suffers its conditions' effects, then, if it still stands, may recover. */
export const conditions = (game: Game): Game => {
  const active = activeOf(game);
  return [...game.entities.values()]
    .filter(({ at }) => at && isActive(active, at))
    .reduce((state, { id }) => {
      const bearer = bearerOf(state, id);
      if (!bearer) return state;
      const after = suffered(state, bearer);
      const standing = bearerOf(after, id);
      return standing ? recovering(after, standing) : after;
    }, game);
};
