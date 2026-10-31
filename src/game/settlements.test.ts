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
import { entitiesWith, tileAt, withOf } from "./world";
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
      expect.objectContaining({ kind: "rose", into: "keep" }),
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

  test("at level 2 the town becomes a keep, at 4 a castle", () => {
    const keep = grownTimes(game, 1);
    expect(settlementOf(keep).kind).toBe("keep");
    expect(eventsOf(keep)).toContainEqual(
      expect.objectContaining({ kind: "rose", into: "keep" }),
    );
    expect(settlementOf(grownTimes(game, 2)).kind).toBe("keep");
    expect(settlementOf(grownTimes(game, 3)).kind).toBe("castle");
  });

  test("barracks and stables wait for a keep", () => {
    const [first] = outpostsOf(grownTimes(game, 1));
    expect(["smithy", "farm"]).toContain(first!.kind);
  });

  test("rising toughens it", () => {
    const keep = grownTimes(game, 1);
    expect(settlementOf(keep).maxHp).toBeGreaterThan(settlementOf(game).maxHp);
  });

  test("its folk move with it, and its new boss comes first", () => {
    const bailiff = creature(east, "bailiff", "nw", TOWN);
    const peopled = withCreatures(game, [bailiff]);
    const keep = act(grownTimes(peopled, 1), WAIT);
    const folk = folkOf(keep);
    expect(folk.map(({ kind }) => kind).sort()).toEqual(["bailiff", "baron"]);
    for (const { home } of folk) expect(home.kind).toBe("keep");
  });

  test("a castle keeps a duke, a baron and a bailiff", () => {
    const castle = grownTimes(game, 3);
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

  describe("ground", () => {
    /** Rising one block per hex from the town outward. */
    const slope = Object.fromEntries(
      hexesWithin(16).map((offset) => [
        hexKey(add(TOWN.at, offset)),
        land(10 + hexDistance(offset, { q: 0, r: 0 })),
      ]),
    );
    const sloped = gameWith([], landOf(slope, [TOWN]));
    /** Ground at each distance from the town, along hexes far from every outpost. */
    const profileOf = (state: Game) => {
      const remote = (hex: Hex) =>
        outpostsOf(state).every(({ at }) => hexDistance(at, hex) > 3);
      return Array.from({ length: 7 }, (_, d) => {
        const hex = hexesWithin(d)
          .map((offset) => add(TOWN.at, offset))
          .find((each) => hexDistance(each, TOWN.at) === d && remote(each))!;
        return tileAt(state, hex).ground;
      });
    };

    test("a town levels 2 hexes around it, smoothing 2 beyond", () => {
      expect(profileOf(sloped)).toEqual([10, 10, 10, 11, 13, 15, 16]);
    });

    test("a keep levels 3, a castle 4", () => {
      expect(profileOf(grownTimes(sloped, 1))).toEqual([
        10, 10, 10, 10, 11, 13, 16,
      ]);
      expect(profileOf(grownTimes(sloped, 3)).slice(0, 6)).toEqual([
        10, 10, 10, 10, 10, 12,
      ]);
    });

    test("outposts level 1 hex around them to their settlement's ground, clearing trees", () => {
      const wooded = Object.fromEntries(
        hexesWithin(16).map((offset) => [
          hexKey(add(TOWN.at, offset)),
          land(10 + hexDistance(offset, { q: 0, r: 0 }), offset.q % 2 === 0),
        ]),
      );
      const state = grownTimes(gameWith([], landOf(wooded, [TOWN])), 3);
      expect(outpostsOf(state).length).toBeGreaterThan(0);
      for (const { at } of outpostsOf(state))
        for (const offset of hexesWithin(1))
          expect(tileAt(state, add(at, offset))).toMatchObject({
            ground: 10,
            tree: false,
          });
    });

    test("water is never leveled", () => {
      const pond = { q: TOWN.at.q + 1, r: TOWN.at.r };
      const wet = gameWith(
        [],
        landOf({ ...slope, [hexKey(pond)]: water }, [TOWN]),
      );
      expect(tileAt(wet, pond)).toEqual(water);
    });
  });
});
