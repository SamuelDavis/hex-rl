import { has } from "../components";
import { add, DIRECTIONS } from "../hex";
import { isBlocked, isInReach, recorded, updated, whoIs } from "../world";
import { performed, refused, type Rule, type Step, type Turn } from "./deeds";

export const turn: Rule<Turn> = (game, { direction }, actor) => {
  if (!has(actor, "position")) return refused("unable");
  if (actor.facing === direction) return refused("already-facing");
  return performed(
    recorded(updated(game, actor.id, { facing: direction }), {
      kind: "turned",
      source: whoIs(game, actor),
      facing: direction,
    }),
  );
};

export const step: Rule<Step> = (game, { direction }, actor) => {
  if (!has(actor, "position")) return refused("unable");
  const { at, facing } = actor;
  if (facing !== direction) return refused("not-facing");
  const to = add(at, DIRECTIONS[direction]);
  if (!isInReach(game, at, to)) return refused("blocked");
  if (isBlocked(game, to)) return refused("occupied");
  return performed(
    recorded(updated(game, actor.id, { at: to }), {
      kind: "stepped",
      source: whoIs(game, actor),
      direction,
      to,
    }),
  );
};
