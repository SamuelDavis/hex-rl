import { rngOf } from "procgen";
import { has, type With } from "../components";
import { abilityOf, type AbilityId } from "../content/abilities";
import { applied, problemOf, type Effect } from "../effects";
import { hexDistance, hexKey, type Hex } from "../hex";
import type { Item, PotionKind } from "../items";
import { masteryOf, spellLevelOf, unlocksOf } from "../progression";
import { visibleFrom } from "../sight";
import {
  caused,
  isBeside,
  occupantAt,
  recorded,
  updated,
  whoIs,
  withOf,
  type Game,
  tilesOf,
} from "../world";
import {
  performed,
  refused,
  type Learn,
  type Rejection,
  type Rule,
  type Use,
} from "./deeds";

export type Aim =
  | { readonly kind: "none" }
  | { readonly kind: "creature" }
  | { readonly kind: "hex"; readonly range: number };

/** When an ability triggers by itself, at `chance`: while its caster's Mind is hostile or idle, or on a hit it lands. */
export interface Trigger {
  readonly on: "hostile" | "idle" | "hit";
  readonly chance: number;
}

/** A row in `content/abilities.ts`: spells, potions and creatures' knacks alike. */
export interface Ability {
  readonly mp: number;
  /** Turns after use before it can be used again; a range is rolled each use. */
  readonly cooldown: number | readonly [min: number, max: number];
  readonly spendsTurn: boolean;
  readonly consumes?: PotionKind;
  readonly aim: Aim;
  readonly effects: readonly Effect[];
  readonly trigger?: Trigger;
  readonly summary: string;
}

type Caster = With<"caster" | "position">;

export const cooldownOf = (
  { turn }: Game,
  { readyAt }: With<"caster">,
  id: AbilityId,
): number => Math.max(0, (readyAt.get(id) ?? 0) - turn);

const supplyOf = (caster: Caster, id: AbilityId): Item | undefined => {
  const { consumes } = abilityOf(id);
  return caster.pack?.find(
    (item) => item.kind === "potion" && item.potion === consumes,
  );
};

export const unreadinessOf = (
  game: Game,
  caster: Caster,
  id: AbilityId,
): Rejection | undefined => {
  const { mp, consumes } = abilityOf(id);
  if (masteryOf(caster, id) === 0) return "unlearned";
  if (cooldownOf(game, caster, id) > 0) return "not-ready";
  if (mp > 0 && (caster.mp ?? 0) < mp) return "no-mana";
  if (consumes && !supplyOf(caster, id)) return "no-item";
  return undefined;
};

const aimProblemOf = (
  game: Game,
  { at: from, facing }: Caster,
  { ability, at }: Use,
): Rejection | undefined => {
  const { aim } = abilityOf(ability);
  if (aim.kind === "creature") {
    const target = at && occupantAt(game, at);
    if (!target?.at || !has(target, "health")) return "no-target";
    return isBeside(game, from, target.at) ? undefined : "out-of-reach";
  }
  if (aim.kind === "hex") {
    if (!at || hexDistance(from, at) > aim.range) return "out-of-range";
    if (!visibleFrom(tilesOf(game), from, facing).has(hexKey(at)))
      return "out-of-sight";
  }
  return undefined;
};

const contextOf = (game: Game, caster: Caster, id: AbilityId, at?: Hex) => ({
  source: whoIs(game, caster),
  origin: caster.id,
  at,
  mastery: masteryOf(caster, id),
});

const effectsProblemOf = (
  game: Game,
  caster: Caster,
  id: AbilityId,
  at?: Hex,
): Rejection | undefined => {
  const context = contextOf(game, caster, id, at);
  return abilityOf(id)
    .effects.map((effect) => problemOf(game, effect, context))
    .find((problem) => problem !== undefined);
};

const readyAtOf = (game: Game, caster: Caster, id: AbilityId): number => {
  const { cooldown } = abilityOf(id);
  const turns =
    typeof cooldown === "number"
      ? cooldown
      : rngOf(game.land.seed, "cooldown")
          .child(caster.id)
          .int(cooldown[0], cooldown[1], game.turn);
  return game.turn + 1 + turns;
};

/** Pays `id`'s costs: mana, its potion, and its cooldown. */
const spent = (game: Game, caster: Caster, id: AbilityId): Game => {
  const { mp, cooldown } = abilityOf(id);
  const supply = supplyOf(caster, id);
  return updated(game, caster.id, {
    ...(caster.mp !== undefined && { mp: caster.mp - mp }),
    ...(supply && { pack: caster.pack!.filter((item) => item !== supply) }),
    ...(cooldown !== 0 && {
      readyAt: new Map([...caster.readyAt, [id, readyAtOf(game, caster, id)]]),
    }),
  });
};

/** Pays for `id` and applies its effects, each event caused by it. */
const cast = (game: Game, caster: Caster, id: AbilityId, at?: Hex): Game => {
  const context = contextOf(game, caster, id, at);
  return caused(game, { kind: "ability", ability: id }, (paying) =>
    abilityOf(id).effects.reduce(
      (state, effect) => applied(state, effect, context),
      spent(paying, caster, id),
    ),
  );
};

export const use: Rule<Use> = (game, deed, actor) => {
  if (!has(actor, "caster", "position")) return refused("unable");
  const { ability, at } = deed;
  const problem =
    unreadinessOf(game, actor, ability) ??
    aimProblemOf(game, actor, deed) ??
    effectsProblemOf(game, actor, ability, at);
  if (problem) return refused(problem);
  const used = recorded(game, {
    kind: "used",
    source: whoIs(game, actor),
    ability,
  });
  return performed(
    cast(used, actor, ability, at),
    abilityOf(ability).spendsTurn,
  );
};

/** `caster`'s abilities triggered by `on` this turn: ready, rolled at their chance, and able to do something. */
export const triggeredOf = (
  game: Game,
  caster: Caster,
  on: Trigger["on"],
  at?: Hex,
): readonly AbilityId[] =>
  [...caster.abilities.keys()].filter((id) => {
    const { trigger } = abilityOf(id);
    return (
      trigger?.on === on &&
      unreadinessOf(game, caster, id) === undefined &&
      rngOf(game.land.seed, "cast")
        .child(caster.id)
        .child(id)
        .chance(trigger.chance, game.turn) &&
      effectsProblemOf(game, caster, id, at) === undefined
    );
  });

/** Casts every ability of `caster` that a hit it landed at `at` triggers. */
export const onHit = (game: Game, caster: string, at: Hex): Game => {
  const attacker = withOf(game, caster, "caster", "position");
  if (!attacker) return game;
  return triggeredOf(game, attacker, "hit", at).reduce((state, id) => {
    const current = withOf(state, caster, "caster", "position");
    return current ? cast(state, current, id, at) : state;
  }, game);
};

/** Spends an unlock raising `spell` a level; costs no turn. */
export const learn: Rule<Learn> = (game, { spell }, actor) => {
  if (!has(actor, "caster", "progression")) return refused("unable");
  if (unlocksOf(actor) === 0) return refused("no-unlocks");
  const level = spellLevelOf(actor, spell) + 1;
  return performed(
    recorded(
      updated(game, actor.id, {
        abilities: new Map([...actor.abilities, [spell, level]]),
      }),
      { kind: "learned", source: whoIs(game, actor), spell, level },
    ),
    false,
  );
};
