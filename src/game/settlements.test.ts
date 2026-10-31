import { describe, expect, test } from "vitest";
import { act, creaturesOf, playerOf, type Game } from "./game";
import { spawnerIdOf } from "./archetypes";
import { has } from "./components";
import { OUTPOSTS } from "./content/settlements";
import {
  add,
  hexDistance,
  hexKey,
  hexesWithin,
  sameHex,
  type Hex,
} from "./hex";
import { grown, OUTPOST_REACH } from "./settlements";
import { Biome, type Spawner, type Tile } from "./terrain";
import { entitiesWith, withOf } from "./world";
import {
  creature,
  east,
  eventsOf,
  gameWith,
  land,
  landOf,
  step,
  WAIT,
  withCreatures,
  withPlayer,
} from "./testing";

const TOWN: Spawner = { kind: "town", at: { q: -6, r: 0 } };

const settlementOf = (game: Game) =>
  withOf(game, spawnerIdOf(TOWN.at), "settlement", "spawning", "health")!;

const outpostsOf = (game: Game) =>
  entitiesWith(game, "fealty", "spawning", "position");

const folkOf = (game: Game) =>
  creaturesOf(game).filter(({ home }) => sameHex(home.at, TOWN.at));

const grownTimes = (game: Game, times: number): Game =>
  Array.from({ length: times }).reduce<Game>(
    (state) => grown(state, TOWN.at),
    game,
  );

const tilesAround = (at: Hex, tile: Tile) =>
  Object.fromEntries(
    hexesWithin(1).map((offset) => [hexKey(add(at, offset)), tile]),
  );

const water: Tile = { ...land(10), water: 11 };

describe("settlements", () => {
  const game = gameWith([], landOf({}, [TOWN]));

  test("start at level 1, as a town", () => {
    expect(settlementOf(game)).toMatchObject({ kind: "town", townLevel: 1 });
  });

  test("each level founds one outpost nearby, sworn to the town", () => {
    const next = grown(game, TOWN.at);
    expect(settlementOf(next).townLevel).toBe(2);
    const [outpost] = outpostsOf(next);
    expect(outpostsOf(next)).toHaveLength(1);
    expect(outpost!.liege).toEqual(TOWN.at);
    expect(hexDistance(outpost!.at, TOWN.at)).toBeLessThanOrEqual(
      OUTPOST_REACH,
    );
    expect(outpost!.faction).toBe("town");
    expect(eventsOf(next).slice(game.events.length)).toEqual([
      expect.objectContaining({ kind: "grew", level: 2 }),
      expect.objectContaining({
        kind: "founded",
        target: expect.objectContaining({ kind: outpost!.kind }),
      }),
    ]);
  });

  test("found each kind of outpost once, only where its terrain allows", () => {
    const kinds = outpostsOf(grownTimes(game, 12)).map(({ kind }) => kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds.sort()).toEqual(["barracks", "farm", "smithy", "stables"]);
  });

  test("docks need water, mines mountains, sawmills trees, bazaars desert", () => {
    const tiles = {
      ...tilesAround({ q: -9, r: 0 }, water),
      ...tilesAround(
        { q: -6, r: -3 },
        {
          ...land(10),
          biome: Biome.Mountain,
        },
      ),
      ...tilesAround({ q: -3, r: 0 }, land(10, true)),
      ...tilesAround({ q: -6, r: 3 }, { ...land(10), biome: Biome.Desert }),
    };
    const varied = gameWith([], landOf(tiles, [TOWN]));
    const kinds = outpostsOf(grownTimes(varied, 12)).map(({ kind }) => kind);
    expect(kinds.sort()).toEqual(Object.keys(OUTPOSTS).sort());
  });

  test("outposts take free, dry, treeless hexes away from other spawners", () => {
    const grownUp = grownTimes(game, 12);
    const spawners = entitiesWith(grownUp, "spawning", "position");
    for (const outpost of outpostsOf(grownUp))
      for (const other of spawners)
        if (other.id !== outpost.id)
          expect(hexDistance(outpost.at, other.at)).toBeGreaterThan(1);
  });

  test("at level 4 the town becomes a keep, at 8 a castle", () => {
    const keep = grownTimes(game, 3);
    expect(settlementOf(keep).kind).toBe("keep");
    expect(eventsOf(keep)).toContainEqual(
      expect.objectContaining({ kind: "rose", into: "keep" }),
    );
    expect(settlementOf(grownTimes(game, 7)).kind).toBe("castle");
  });

  test("rising toughens it", () => {
    const keep = grownTimes(game, 3);
    expect(settlementOf(keep).maxHp).toBeGreaterThan(settlementOf(game).maxHp);
  });

  test("its folk move with it, and its new boss comes first", () => {
    const bailiff = creature(east, "bailiff", "nw", TOWN);
    const peopled = withCreatures(game, [bailiff]);
    const keep = act(grownTimes(peopled, 3), WAIT);
    const folk = folkOf(keep);
    expect(folk.map(({ kind }) => kind).sort()).toEqual(["bailiff", "baron"]);
    for (const { home } of folk) expect(home.kind).toBe("keep");
  });

  test("a castle keeps a duke, a baron and a bailiff", () => {
    const castle = grownTimes(game, 7);
    const peopled = Array.from({ length: 40 }).reduce<Game>(
      (state) => act(state, WAIT),
      castle,
    );
    const kinds = folkOf(peopled).map(({ kind }) => kind);
    for (const kind of ["duke", "baron", "bailiff"] as const)
      expect(kinds.filter((each) => each === kind)).toHaveLength(1);
  });

  test("paying a bounty grows the bailiff's town", () => {
    const bailiff = creature(east, "bailiff", "nw", TOWN);
    const bounty = {
      kind: "den",
      at: { q: 9, r: 9 },
      level: 1,
      isSlain: true,
    } as const;
    const claimed = withPlayer(gameWith([bailiff], landOf({}, [TOWN])), {
      bounty,
    });
    const paid = act(claimed, step("se"));
    expect(playerOf(paid).bounty?.isSlain).not.toBe(true);
    expect(settlementOf(paid).townLevel).toBe(2);
    expect(outpostsOf(paid)).toHaveLength(1);
  });

  test("only settlements grow", () => {
    const lair: Spawner = { kind: "den", at: { q: -6, r: 0 } };
    const wild = gameWith([], landOf({}, [lair]));
    expect(grown(wild, lair.at)).toBe(wild);
    expect(has(wild.entities.get(spawnerIdOf(lair.at))!, "settlement")).toBe(
      false,
    );
  });
});
