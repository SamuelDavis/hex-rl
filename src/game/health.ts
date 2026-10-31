import { has, type Entity, type With } from "./components";
import { CREATURES, type CreatureKind } from "./content/creatures";
import { relationOf } from "./content/factions";
import { piledOn } from "./chests";
import type { Who } from "./events";
import type { Hex } from "./hex";
import { lootOf } from "./items";
import { credited } from "./progression";
import {
  occupantAt,
  recorded,
  removed,
  updated,
  whoIs,
  type Game,
} from "./world";

const isCreatureKind = (kind: Entity["kind"]): kind is CreatureKind =>
  kind in CREATURES;

const dropLoot = (game: Game, slain: Entity & { readonly at: Hex }): Game => {
  if (!isCreatureKind(slain.kind)) return game;
  const loot = lootOf(game.land.seed, { id: slain.id, kind: slain.kind });
  if (!loot) return game;
  return recorded(piledOn(game, slain.at, loot), {
    kind: "dropped",
    source: whoIs(game, slain),
  });
};

/** Whether it still stands: above 0 hit points, or wrecked, which a thing endures. */
export const isStanding = ({ hp, onDepleted }: With<"health">): boolean =>
  hp > 0 || onDepleted === "wreck";

/** Takes `amount` hit points from `target`; at 0 it perishes, falls or is wrecked, by its `onDepleted`. */
export const damaged = (
  game: Game,
  source: Who,
  target: With<"health" | "position">,
  amount: number,
): Game => {
  const hp = Math.max(0, target.hp - amount);
  const victim = whoIs(game, target);
  if (hp > 0 || target.isWrecked)
    return recorded(updated(game, target.id, { hp }), {
      kind: "hurt",
      source,
      target: victim,
      amount,
    });
  switch (target.onDepleted) {
    case "perish": {
      const slain = recorded(removed(game, target.id), {
        kind: "killed",
        source,
        target: victim,
      });
      return dropLoot(credited(slain, source, target), target);
    }
    case "fall":
      return recorded(updated(game, target.id, { hp }), {
        kind: "killed",
        source,
        target: victim,
      });
    case "wreck":
      return recorded(
        updated(game, target.id, { hp, isWrecked: true, isBossDue: true }),
        { kind: "wrecked", source, target: victim },
      );
  }
};

/** Hurts whoever stands at `at`, if `source` is hostile to them. */
export const hit = (game: Game, source: Who, at: Hex, amount: number): Game => {
  const target = occupantAt(game, at);
  if (
    !target ||
    !has(target, "health", "position", "allegiance") ||
    relationOf(source.faction, target.faction) !== "hostile"
  )
    return game;
  return damaged(game, source, target, amount);
};
