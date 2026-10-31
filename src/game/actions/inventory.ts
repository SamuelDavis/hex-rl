import { rngOf } from "procgen";
import { chestAt, EMPTY, piledOn, withChest } from "../chests";
import { has, type With } from "../components";
import {
  capacityOf,
  fits,
  loadOf,
  overflowOf,
  takenOf,
  PLACE_NAMES,
  PLACES,
  type Chest,
  type Item,
  type Place,
} from "../items";
import { recorded, updated, whoIs, type Game } from "../world";
import {
  GOLD,
  performed,
  refused,
  type Destroy,
  type Outcome,
  type Prepare,
  type Rule,
  type TakeAll,
  type Transfer,
} from "./deeds";

/** Where cargo can be: the pack, the chest on the ground underfoot, or a paper-doll place. */
export type Where = "pack" | "ground" | Place;

export type Cargo = Item | { readonly kind: "gold"; readonly amount: number };

type Carrier = With<"inventory" | "purse" | "position">;

const isPlace = (where: Where): where is Place => where in PLACES;

const underfoot = (game: Game, { at }: Carrier): Chest =>
  chestAt(game, at) ?? EMPTY;

const carrierOf = (game: Game, id: string): Carrier =>
  game.entities.get(id) as Carrier;

const locate = (
  game: Game,
  carrier: Carrier,
  id: string,
): readonly [Item, Where] | undefined => {
  const { pack, equipment } = carrier;
  const isIt = (item: Item | undefined) => item?.id === id;
  const packed = pack.find(isIt);
  if (packed) return [packed, "pack"];
  const lying = underfoot(game, carrier).items.find(isIt);
  if (lying) return [lying, "ground"];
  const place = PLACE_NAMES.find((place) => isIt(equipment[place]));
  return place && [equipment[place]!, place];
};

const removedFrom = (game: Game, id: string, item: Item, from: Where): Game => {
  const carrier = carrierOf(game, id);
  const { pack, equipment, at } = carrier;
  if (from === "pack")
    return updated(game, id, { pack: pack.filter((held) => held !== item) });
  if (from === "ground") {
    const chest = underfoot(game, carrier);
    const items = chest.items.filter((held) => held !== item);
    return withChest(game, at, { ...chest, items });
  }
  return updated(game, id, {
    equipment: Object.fromEntries(
      Object.entries(equipment).filter(([place]) => place !== from),
    ),
  });
};

const addedTo = (game: Game, id: string, item: Item, to: Where): Game => {
  const { pack, equipment, at } = carrierOf(game, id);
  if (to === "pack") return updated(game, id, { pack: [...pack, item] });
  if (to === "ground") return piledOn(game, at, { gold: 0, items: [item] });
  return updated(game, id, { equipment: { ...equipment, [to]: item } });
};

const relocated = (
  game: Game,
  id: string,
  item: Item,
  from: Where,
  to: Where,
): Game => addedTo(removedFrom(game, id, item, from), id, item, to);

/** Drops what no longer fits the pack. */
const spilled = (game: Game, id: string): Game => {
  const carrier = carrierOf(game, id);
  const { pack, equipment, at } = carrier;
  const rng = rngOf(game.land.seed, "spill", game.turn);
  const { kept, spilled } = overflowOf(pack, capacityOf(equipment), rng);
  if (spilled.length === 0) return game;
  return recorded(
    piledOn(updated(game, id, { pack: kept }), at, { gold: 0, items: spilled }),
    { kind: "spilled", source: whoIs(game, carrier), items: spilled },
  );
};

const transferGold = (game: Game, carrier: Carrier, to: Where): Outcome => {
  if (isPlace(to)) return refused("misfit");
  const chest = underfoot(game, carrier);
  const from = to === "pack" ? "ground" : "pack";
  const amount = to === "pack" ? chest.gold : carrier.gold;
  if (amount === 0) return refused("no-item");
  const gold = to === "pack" ? carrier.gold + amount : 0;
  const lying = to === "pack" ? 0 : chest.gold + amount;
  return performed(
    recorded(
      withChest(updated(game, carrier.id, { gold }), carrier.at, {
        ...chest,
        gold: lying,
      }),
      {
        kind: "moved",
        source: whoIs(game, carrier),
        cargo: { kind: "gold", amount },
        from,
        to,
      },
    ),
  );
};

const transferItem = (
  game: Game,
  carrier: Carrier,
  { cargo, to }: Transfer,
): Outcome => {
  const found = locate(game, carrier, cargo);
  if (!found) return refused("no-item");
  const [item, from] = found;
  if (from === to || (isPlace(to) && !fits(item, to))) return refused("misfit");
  const { id } = carrier;
  const worn = isPlace(to) ? carrier.equipment[to] : undefined;
  const swapped = worn ? relocated(game, id, worn, to, from) : game;
  const next = relocated(swapped, id, item, from, to);
  const after = carrierOf(next, id);
  const capacity = capacityOf(after.equipment);
  const isOver = loadOf(after.pack) > capacity;
  if (isOver && capacity >= capacityOf(carrier.equipment))
    return refused("full");
  return performed(
    spilled(
      recorded(next, {
        kind: "moved",
        source: whoIs(game, carrier),
        cargo: item,
        from,
        to,
      }),
      id,
    ),
  );
};

const isCarrier = (actor: Parameters<Rule<Transfer>>[2]): actor is Carrier =>
  has(actor, "inventory", "purse", "position");

export const transfer: Rule<Transfer> = (game, deed, actor) => {
  if (!isCarrier(actor)) return refused("unable");
  return deed.cargo === GOLD
    ? transferGold(game, actor, deed.to)
    : transferItem(game, actor, deed);
};

export const takeAll: Rule<TakeAll> = (game, _, actor) => {
  if (!isCarrier(actor)) return refused("unable");
  const { at, pack, equipment, gold } = actor;
  const chest = chestAt(game, at);
  if (!chest) return refused("no-chest");
  const room = capacityOf(equipment) - loadOf(pack);
  const rng = rngOf(game.land.seed, "take", game.turn);
  const taken = takenOf(chest.items, room, rng);
  if (chest.gold === 0 && taken.length === 0) return refused("full");
  const cargo: readonly Cargo[] = [
    ...(chest.gold > 0 ? [{ kind: "gold", amount: chest.gold } as const] : []),
    ...taken,
  ];
  const next = withChest(
    updated(game, actor.id, {
      gold: gold + chest.gold,
      pack: [...pack, ...taken],
    }),
    at,
    { gold: 0, items: chest.items.filter((item) => !taken.includes(item)) },
  );
  const source = whoIs(game, actor);
  return performed(
    cargo.reduce(
      (taking, moved) =>
        recorded(taking, {
          kind: "moved",
          source,
          cargo: moved,
          from: "ground",
          to: "pack",
        }),
      next,
    ),
  );
};

export const destroy: Rule<Destroy> = (game, _, actor) => {
  if (!has(actor, "position")) return refused("unable");
  if (!chestAt(game, actor.at)) return refused("no-chest");
  return performed(
    recorded(withChest(game, actor.at, EMPTY), {
      kind: "destroyed",
      source: whoIs(game, actor),
    }),
  );
};

export const prepare: Rule<Prepare> = (game, _, actor) =>
  performed(recorded(game, { kind: "prepared", source: whoIs(game, actor) }));
