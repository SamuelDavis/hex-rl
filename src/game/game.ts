import { findPath, rngOf, type Bounds } from "procgen";
import { canStep } from "./explorer";
import {
  add,
  centerOf,
  DIRECTIONS,
  directionBetween,
  flanksOf,
  HEADINGS,
  hexDistance,
  hexKey,
  neighborsOf,
  sameHex,
  type Direction,
  type Hex,
} from "./hex";
import { IDLE, sighted, tetherOf, unsighted, type Mind } from "./mind";
import { MONSTERS, SPAWNERS, spawnerHpOf, type MonsterKind } from "./monsters";
import { canNotice, SIGHT, visibleFrom } from "./sight";
import {
  CLEAVE_SPLASH,
  FIREBALL_DAMAGE,
  FIREBALL_SPLASH,
  fireballSplashOf,
  HEAL_HP,
  SPELLS,
  type SpellId,
} from "./spells";
import type { Spawner, Tile } from "./terrain";

export const MAX_HP = 20;
export const MAX_MP = 10;
export const PLAYER_DAMAGE = 2;
export const ACTIVE_RADIUS = SIGHT + 4;
export const FORGET_RADIUS = ACTIVE_RADIUS + 8;
export const HUNT_RADIUS = 4;
export const SPAWNER_HEAL_INTERVAL = 5;
const WANDER_CHANCE = 0.3;
const HP_REGEN_INTERVAL = 10;
const MP_REGEN_INTERVAL = 2;
const LOG_LENGTH = 50;
const PATH_BUDGET = 200;

export interface Land {
  readonly seed: number;
  readonly spawn: Hex;
  tileAt(hex: Hex): Tile;
  spawnersIn(bounds: Bounds): readonly Spawner[];
}

export interface Player {
  readonly at: Hex;
  readonly facing: Direction;
  readonly hp: number;
  readonly mp: number;
  /** The turn each spell cast is ready again. */
  readonly spellsReadyAt: ReadonlyMap<SpellId, number>;
  readonly gold: number;
}

export interface Monster {
  readonly id: string;
  readonly kind: MonsterKind;
  readonly home: Spawner;
  readonly at: Hex;
  readonly facing: Direction;
  readonly hp: number;
  readonly mind: Mind;
}

export interface SpawnerState {
  readonly readyAt: number;
  readonly hp: number;
  readonly hurtAt: number;
  /** Wrecked spawners stop spawning until fully healed. */
  readonly isWrecked: boolean;
  /** Set when wrecked; the boss emerges once a hex beside the spawner is free. */
  readonly isBossDue: boolean;
}

export interface Game {
  readonly land: Land;
  readonly player: Player;
  readonly monsters: readonly Monster[];
  readonly spawners: ReadonlyMap<string, SpawnerState>;
  /** Gold lying on the ground, by hex key. */
  readonly gold: ReadonlyMap<string, number>;
  readonly kills: number;
  readonly seen: ReadonlySet<string>;
  readonly turn: number;
  readonly log: readonly string[];
}

export interface Cast {
  readonly spell: SpellId;
  readonly at?: Hex | undefined;
}

export type Action = Direction | "wait" | Cast;

export const isOver = (game: Game): boolean => game.player.hp <= 0;

export const cooldownOf = ({ player, turn }: Game, spell: SpellId): number =>
  Math.max(0, (player.spellsReadyAt.get(spell) ?? 0) - turn);

const stateOf = (game: Game, { kind, at }: Spawner): SpawnerState =>
  game.spawners.get(hexKey(at)) ?? {
    readyAt: 0,
    hp: spawnerHpOf(kind),
    hurtAt: 0,
    isWrecked: false,
    isBossDue: false,
  };

export const spawnerHp = (game: Game, spawner: Spawner): number => {
  const { hp, hurtAt } = stateOf(game, spawner);
  const healed = Math.floor((game.turn - hurtAt) / SPAWNER_HEAL_INTERVAL);
  return Math.min(spawnerHpOf(spawner.kind), hp + healed);
};

export const isWrecked = (game: Game, spawner: Spawner): boolean =>
  stateOf(game, spawner).isWrecked &&
  spawnerHp(game, spawner) < spawnerHpOf(spawner.kind);

const logged = (game: Game, ...messages: string[]): Game => ({
  ...game,
  log: [...game.log, ...messages].slice(-LOG_LENGTH),
});

export const visibleOf = ({ land, player }: Game): Set<string> =>
  visibleFrom(land.tileAt, player.at, player.facing);

const withSight = (game: Game): Game => ({
  ...game,
  seen: new Set([...game.seen, ...visibleOf(game)]),
});

const monsterAt = (game: Game, hex: Hex) =>
  game.monsters.find(({ at }) => sameHex(at, hex));

const isOccupied = (game: Game, hex: Hex) =>
  sameHex(hex, game.player.at) || monsterAt(game, hex) !== undefined;

const spawnerAt = (game: Game, hex: Hex) =>
  game.land.spawnersIn(boundsAround(hex, 1)).find(({ at }) => sameHex(at, hex));

const isBlocked = (game: Game, hex: Hex) =>
  isOccupied(game, hex) || spawnerAt(game, hex) !== undefined;

const boundsAround = (hex: Hex, radius: number): Bounds => {
  const { x, y } = centerOf(hex);
  const reach = 2 * radius;
  return { minX: x - reach, minY: y - reach, maxX: x + reach, maxY: y + reach };
};

const withSpawner = (
  game: Game,
  { at }: Spawner,
  state: SpawnerState,
): Game => ({
  ...game,
  spawners: new Map([...game.spawners, [hexKey(at), state]]),
});

const spawnSiteOf = (game: Game, { at }: Spawner): Hex | undefined => {
  const sites = neighborsOf(at).filter(
    (next) => canStep(game.land.tileAt, at, next) && !isBlocked(game, next),
  );
  if (sites.length === 0) return undefined;
  return rngOf(game.land.seed, "spawns").pick(sites, at.q, at.r, game.turn, 3);
};

const spawnedFrom = (
  { land, turn }: Game,
  spawner: Spawner,
  kind: MonsterKind,
  at: Hex,
): Monster => ({
  id: `${hexKey(spawner.at)}@${turn}`,
  kind,
  home: spawner,
  at,
  facing: rngOf(land.seed, "spawns").pick(HEADINGS, at.q, at.r, turn, 2),
  hp: MONSTERS[kind].hp,
  mind: IDLE,
});

const unleashBoss = (game: Game, spawner: Spawner): Game => {
  const { boss } = SPAWNERS[spawner.kind];
  const site = spawnSiteOf(game, spawner);
  if (!site) return game;
  const monster = spawnedFrom(game, spawner, boss, site);
  return logged(
    withSpawner(
      {
        ...game,
        monsters: [
          ...game.monsters,
          { ...monster, mind: sighted(monster.mind, monster.at, game.player) },
        ],
      },
      spawner,
      { ...stateOf(game, spawner), isBossDue: false },
    ),
    `The ${boss} emerges!`,
  );
};

const spawnFrom = (game: Game, spawner: Spawner): Game => {
  const { land, monsters, turn } = game;
  const { kind, at } = spawner;
  const { pool, cap, interval, chance } = SPAWNERS[kind];
  const state = stateOf(game, spawner);
  if (state.isBossDue) return unleashBoss(game, spawner);
  const rng = rngOf(land.seed, "spawns");
  const site = spawnSiteOf(game, spawner);
  if (
    isWrecked(game, spawner) ||
    !site ||
    monsters.filter(({ home }) => sameHex(home.at, at)).length >= cap
  )
    return game;
  const isRevived = state.isWrecked;
  if (
    !isRevived &&
    (turn < state.readyAt || !rng.chance(chance, at.q, at.r, turn))
  )
    return game;
  const monster = spawnedFrom(
    game,
    spawner,
    rng.weighted(pool, at.q, at.r, turn, 1),
    site,
  );
  return withSpawner({ ...game, monsters: [...monsters, monster] }, spawner, {
    ...state,
    readyAt: turn + interval,
    isWrecked: false,
  });
};

const populate = (game: Game): Game => {
  const { land, player } = game;
  const kept = game.monsters.filter(
    ({ at }) => hexDistance(at, player.at) <= FORGET_RADIUS,
  );
  return land
    .spawnersIn(boundsAround(player.at, ACTIVE_RADIUS))
    .filter(({ at }) => hexDistance(at, player.at) <= ACTIVE_RADIUS)
    .reduce(spawnFrom, { ...game, monsters: kept });
};

export const newGame = (land: Land): Game =>
  withSight(
    populate({
      land,
      player: {
        at: land.spawn,
        facing: "n",
        hp: MAX_HP,
        mp: MAX_MP,
        spellsReadyAt: new Map(),
        gold: 0,
      },
      monsters: [],
      spawners: new Map(),
      gold: new Map(),
      kills: 0,
      seen: new Set(),
      turn: 0,
      log: ["You set out into the wilds."],
    }),
  );

const dropGold = (game: Game, { id, kind, at }: Monster): Game => {
  const { chance, min, max } = MONSTERS[kind].gold;
  const rng = rngOf(game.land.seed, "gold").child(id);
  if (!rng.chance(chance, game.turn)) return game;
  const amount = rng.int(min, max, game.turn, 1);
  const key = hexKey(at);
  return logged(
    {
      ...game,
      gold: new Map([...game.gold, [key, (game.gold.get(key) ?? 0) + amount]]),
    },
    `The ${kind} drops ${amount} gold.`,
  );
};

const pickUpGold = (game: Game): Game => {
  const key = hexKey(game.player.at);
  const amount = game.gold.get(key);
  if (!amount) return game;
  const gold = new Map(game.gold);
  gold.delete(key);
  return logged(
    {
      ...game,
      gold,
      player: { ...game.player, gold: game.player.gold + amount },
    },
    `You pick up ${amount} gold.`,
  );
};

const attackMonster = (game: Game, target: Monster, damage: number): Game => {
  const hp = target.hp - damage;
  if (hp > 0)
    return logged(
      {
        ...game,
        monsters: game.monsters.map((m) => (m === target ? { ...m, hp } : m)),
      },
      `You hit the ${target.kind}.`,
    );
  return dropGold(
    logged(
      {
        ...game,
        monsters: game.monsters.filter((m) => m !== target),
        kills: game.kills + 1,
      },
      `You kill the ${target.kind}.`,
    ),
    target,
  );
};

const attackSpawner = (game: Game, spawner: Spawner, damage: number): Game => {
  const hp = Math.max(0, spawnerHp(game, spawner) - damage);
  const { name } = SPAWNERS[spawner.kind];
  const wasWrecked = isWrecked(game, spawner);
  const hurt = (change: Partial<SpawnerState>) =>
    withSpawner(game, spawner, {
      ...stateOf(game, spawner),
      hp,
      hurtAt: game.turn,
      ...change,
    });
  if (hp > 0 || wasWrecked)
    return logged(hurt({ isWrecked: wasWrecked }), `You hit the ${name}.`);
  return logged(
    hurt({ isWrecked: true, isBossDue: true }),
    `You wreck the ${name}.`,
  );
};

const hit = (game: Game, at: Hex, damage: number): Game => {
  const target = monsterAt(game, at);
  if (target) return attackMonster(game, target, damage);
  const spawner = spawnerAt(game, at);
  if (spawner) return attackSpawner(game, spawner, damage);
  return game;
};

const hitAll = (game: Game, hits: readonly (readonly [Hex, number])[]) =>
  hits.reduce((state, [at, damage]) => hit(state, at, damage), game);

const playerTurn = (game: Game, to: Hex): Game =>
  isBlocked(game, to)
    ? hit(game, to, PLAYER_DAMAGE)
    : pickUpGold({ ...game, player: { ...game.player, at: to } });

const melee = (game: Game, toward: Direction, damage: number): Game => {
  const { land, player } = game;
  const to = add(player.at, DIRECTIONS[toward]);
  return canStep(land.tileAt, player.at, to) ? hit(game, to, damage) : game;
};

const splashed = (damage: number, fraction: number) =>
  Math.ceil(damage * fraction);

const EFFECTS: Record<SpellId, (game: Game, at: Hex | undefined) => Game> = {
  cleave: (game) => {
    const { facing } = game.player;
    const splash = splashed(PLAYER_DAMAGE, CLEAVE_SPLASH);
    return flanksOf(facing).reduce(
      (state, side) => melee(state, side, splash),
      melee(game, facing, PLAYER_DAMAGE),
    );
  },
  fireball: (game, at) => {
    const splash = splashed(FIREBALL_DAMAGE, FIREBALL_SPLASH);
    return hitAll(game, [
      [at!, FIREBALL_DAMAGE],
      ...fireballSplashOf(at!).map((hex) => [hex, splash] as const),
    ]);
  },
  heal: ({ player, ...game }) => ({
    ...game,
    player: { ...player, hp: Math.min(MAX_HP, player.hp + HEAL_HP) },
  }),
  strike: (game, at) => {
    const facing = directionBetween(game.player.at, at!)!;
    return melee(
      { ...game, player: { ...game.player, facing } },
      facing,
      PLAYER_DAMAGE,
    );
  },
};

const aimProblemOf = (game: Game, { spell, at }: Cast): string | undefined => {
  const { aim } = SPELLS[spell];
  const { land, player } = game;
  if (aim.kind === "monster") {
    const target = at && monsterAt(game, at);
    if (!target) return `Cannot cast ${spell} without a target.`;
    const isAdjacent = directionBetween(player.at, target.at) !== undefined;
    if (!isAdjacent || !canStep(land.tileAt, player.at, target.at))
      return `Cannot cast ${spell}: the ${target.kind} is out of reach.`;
  }
  if (aim.kind === "hex") {
    if (!at || hexDistance(player.at, at) > aim.range)
      return `Cannot cast ${spell}: out of range.`;
    if (!visibleOf(game).has(hexKey(at)))
      return `Cannot cast ${spell}: out of sight.`;
  }
  return undefined;
};

export const unreadyReasonOf = (
  game: Game,
  spell: SpellId,
): string | undefined => {
  if (cooldownOf(game, spell) > 0) return `Cannot cast ${spell}: not ready.`;
  if (game.player.mp < SPELLS[spell].mp)
    return `Cannot cast ${spell}: not enough mana.`;
  return undefined;
};

const castProblemOf = (game: Game, cast: Cast): string | undefined =>
  unreadyReasonOf(game, cast.spell) ?? aimProblemOf(game, cast);

const castSpell = (game: Game, cast: Cast): Game => {
  const problem = castProblemOf(game, cast);
  if (problem) return logged(game, problem);
  const { player, turn } = game;
  const { mp, cooldown } = SPELLS[cast.spell];
  const spent = {
    ...player,
    mp: player.mp - mp,
    spellsReadyAt: new Map([
      ...player.spellsReadyAt,
      [cast.spell, turn + 1 + cooldown],
    ]),
  };
  return endTurn(
    EFFECTS[cast.spell](
      logged({ ...game, player: spent }, `You cast ${cast.spell}.`),
      cast.at,
    ),
  );
};

const stepToward = (
  game: Game,
  monster: Monster,
  goal: Hex,
  reach: number,
): Hex | undefined => {
  const route = findPath({
    start: monster.at,
    isGoal: (hex) => hexDistance(hex, goal) <= reach,
    neighbors: (hex) =>
      neighborsOf(hex).filter(
        (next) =>
          canStep(game.land.tileAt, hex, next) && !isBlocked(game, next),
      ),
    cost: () => 1,
    heuristic: (hex) => Math.max(0, hexDistance(hex, goal) - reach),
    keyOf: hexKey,
    maxExpansions: PATH_BUDGET,
  });
  return "path" in route ? route.path[1] : undefined;
};

const updated = (game: Game, monster: Monster, change: Partial<Monster>) => ({
  ...game,
  monsters: game.monsters.map((m) =>
    m.id === monster.id ? { ...m, ...change } : m,
  ),
});

const moved = (game: Game, monster: Monster, to: Hex | undefined): Game =>
  to
    ? updated(game, monster, {
        at: to,
        facing: directionBetween(monster.at, to)!,
      })
    : game;

interface Leash {
  readonly center: Hex;
  readonly radius: number;
}

const leashOf = ({ home, mind }: Monster): Leash => ({
  center: tetherOf(mind, home.at),
  radius: SPAWNERS[home.kind].leash,
});

const isWithin = (hex: Hex, { center, radius }: Leash) =>
  hexDistance(hex, center) <= radius;

const alignment = (from: Hex, to: Hex, heading: Direction | undefined) => {
  if (!heading) return 1;
  const step = centerOf({ q: to.q - from.q, r: to.r - from.r });
  const ahead = centerOf(DIRECTIONS[heading]);
  const dot =
    (step.x * ahead.x + step.y * ahead.y) / (step.x * step.x + step.y * step.y);
  return (1 + dot) * (1 + dot) + 0.1;
};

const wander = (
  game: Game,
  monster: Monster,
  area: Leash,
  chance: number,
  heading?: Direction,
): Game => {
  const { at, id } = monster;
  const rng = rngOf(game.land.seed, "wander").child(id);
  if (!rng.chance(chance, game.turn)) return game;
  const options = neighborsOf(at)
    .filter(
      (next) =>
        isWithin(next, area) &&
        isWithin(next, leashOf(monster)) &&
        canStep(game.land.tileAt, at, next) &&
        !isBlocked(game, next),
    )
    .map((next) => [next, alignment(at, next, heading)] as const);
  if (options.length === 0) return game;
  return moved(game, monster, rng.weighted(options, game.turn, 1));
};

const strike = (game: Game, monster: Monster, toward: Direction): Game => {
  const { player } = game;
  const hp = player.hp - MONSTERS[monster.kind].damage;
  const hit = `The ${monster.kind} hits you.`;
  return logged(
    updated({ ...game, player: { ...player, hp } }, monster, {
      facing: toward,
      mind: sighted(monster.mind, monster.at, game.player),
    }),
    ...(hp > 0 ? [hit] : [hit, "You die."]),
  );
};

const mindOf = ({ land, player }: Game, { at, facing, mind }: Monster): Mind =>
  canNotice(land.tileAt, at, facing, player.at)
    ? sighted(mind, at, player)
    : unsighted(mind, at);

const approach = (
  game: Game,
  monster: Monster,
  goal: Hex,
  reach: number,
): Game => {
  const step = stepToward(game, monster, goal, reach);
  if (!step || !isWithin(step, leashOf(monster))) return game;
  return moved(game, monster, step);
};

const behave = (game: Game, monster: Monster): Game => {
  const { mind, at, home } = monster;
  switch (mind.state) {
    case "idle": {
      const leash = leashOf(monster);
      return isWithin(at, leash)
        ? wander(game, monster, leash, WANDER_CHANCE)
        : moved(
            game,
            monster,
            stepToward(game, monster, home.at, leash.radius),
          );
    }
    case "hostile":
      return approach(
        game,
        monster,
        mind.lastSeen,
        isBlocked(game, mind.lastSeen) ? 1 : 0,
      );
    case "hunting": {
      const area = { center: mind.lastSeen, radius: HUNT_RADIUS };
      return isWithin(at, area)
        ? wander(game, monster, area, 1, mind.heading)
        : approach(game, monster, mind.lastSeen, HUNT_RADIUS);
    }
  }
};

const monsterTurn = (game: Game, monster: Monster): Game => {
  const { land, player } = game;
  if (isOver(game)) return game;
  const toward = directionBetween(monster.at, player.at);
  if (toward && canStep(land.tileAt, monster.at, player.at))
    return strike(game, monster, toward);
  const mind = mindOf(game, monster);
  return behave(updated(game, monster, { mind }), { ...monster, mind });
};

const monstersTurn = (game: Game): Game =>
  game.monsters.reduce(
    (state, { id }) =>
      monsterTurn(
        state,
        state.monsters.find((m) => m.id === id)!,
      ),
    game,
  );

const restored = (
  value: number,
  max: number,
  interval: number,
  turn: number,
) => (turn % interval === 0 ? Math.min(max, value + 1) : value);

const regenerate = (game: Game): Game => {
  if (isOver(game)) return game;
  const { player, turn } = game;
  return {
    ...game,
    player: {
      ...player,
      hp: restored(player.hp, MAX_HP, HP_REGEN_INTERVAL, turn),
      mp: restored(player.mp, MAX_MP, MP_REGEN_INTERVAL, turn),
    },
  };
};

const endTurn = (acted: Game): Game =>
  withSight(
    populate(regenerate(monstersTurn({ ...acted, turn: acted.turn + 1 }))),
  );

export const act = (game: Game, action: Action): Game => {
  if (isOver(game)) return game;
  const { player, land } = game;
  if (action === "wait") return endTurn(game);
  if (typeof action === "object") return castSpell(game, action);
  if (action !== player.facing)
    return endTurn({ ...game, player: { ...player, facing: action } });
  const to = add(player.at, DIRECTIONS[action]);
  if (!canStep(land.tileAt, player.at, to)) return game;
  return endTurn(playerTurn(game, to));
};
