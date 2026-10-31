import { has } from "../components";
import { relationOf } from "../content/factions";
import { hit } from "../health";
import { directionBetween } from "../hex";
import { isBeside, occupantAt, whoIs } from "../world";
import { onHit } from "./abilities";
import { performed, refused, type Attack, type Rule } from "./deeds";

/** Hits a hostile, adjacent, faced entity for its damage × power; a landed hit may trigger abilities. */
export const attack: Rule<Attack> = (game, { at }, actor) => {
  if (!has(actor, "position", "stats", "allegiance")) return refused("unable");
  const target = occupantAt(game, at);
  if (!target || !has(target, "health", "allegiance"))
    return refused("no-target");
  if (relationOf(actor.faction, target.faction) !== "hostile")
    return refused("friendly");
  if (!isBeside(game, actor.at, at)) return refused("out-of-reach");
  if (directionBetween(actor.at, at) !== actor.facing)
    return refused("not-facing");
  const struck = hit(game, whoIs(game, actor), at, actor.damage * actor.power);
  const victim = struck.entities.get(target.id);
  const isStanding = victim !== undefined && (victim.hp ?? 0) > 0;
  return performed(isStanding ? onHit(struck, actor.id, at) : struck);
};
