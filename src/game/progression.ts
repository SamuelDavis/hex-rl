import type { Entity } from "./components";
import {
  abilityOf,
  SPELL_IDS,
  type AbilityId,
  type SpellId,
} from "./content/abilities";
import type { Who } from "./events";
import { bountyHunted } from "./quests";
import { recorded, updated, whoIs, withOf, type Game } from "./world";

export const XP_PER_LEVEL = 10;

export const levelOf = ({ xp }: { readonly xp: number }): number =>
  1 + Math.floor(xp / XP_PER_LEVEL);

export const spellLevelOf = (
  { abilities }: { readonly abilities: ReadonlyMap<AbilityId, number> },
  spell: SpellId,
): number => abilities.get(spell) ?? 0;

/** Levels not yet spent on spells. */
export const unlocksOf = (
  entity: { readonly xp: number } & {
    readonly abilities: ReadonlyMap<AbilityId, number>;
  },
): number =>
  levelOf(entity) -
  1 -
  SPELL_IDS.reduce((sum, spell) => sum + spellLevelOf(entity, spell), 0);

/** Effect multiplier: an ability's level; potions are known to all, at 1. */
export const masteryOf = (
  { abilities }: { readonly abilities: ReadonlyMap<AbilityId, number> },
  id: AbilityId,
): number => abilities.get(id) ?? (abilityOf(id).consumes ? 1 : 0);

/** Credits `source`, if it progresses, with slaying `slain`: a kill, and experience for its hit points × power. */
export const credited = (game: Game, source: Who, slain: Entity): Game => {
  const killer = withOf(game, source.id, "progression");
  if (!killer) return game;
  const xp = killer.xp + (slain.maxHp ?? 0) * (slain.power ?? 1);
  const next = updated(game, killer.id, { xp, kills: killer.kills + 1 });
  const level = levelOf({ xp });
  const leveled =
    level > levelOf(killer)
      ? recorded(next, { kind: "leveled", source: whoIs(game, killer), level })
      : next;
  return bountyHunted(leveled, killer.id, slain);
};
