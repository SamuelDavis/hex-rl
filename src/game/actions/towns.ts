import { has, type With } from "../components";
import { SERVICES } from "../content/creatures";
import {
  capacityOf,
  loadOf,
  offerOf,
  priceOf,
  sizeOf,
  type Item,
} from "../items";
import { bountied } from "../quests";
import {
  isBeside,
  occupantAt,
  recorded,
  updated,
  whoIs,
  withOf,
  type Game,
} from "../world";
import {
  performed,
  refused,
  type Interact,
  type Outcome,
  type Rule,
  type Trade,
} from "./deeds";

type Customer = With<"inventory" | "purse" | "position">;
type Trader = With<"wares" | "purse" | "position">;

/** Hails an adjacent entity; one offering a Service spends the turn (a bailiff pays and posts bounties). */
export const interact: Rule<Interact> = (game, { at }, actor) => {
  if (!has(actor, "position")) return refused("unable");
  if (!at) return refused("no-target");
  if (!isBeside(game, actor.at, at)) return refused("out-of-reach");
  const npc = occupantAt(game, at);
  if (!npc?.at) return refused("no-target");
  const service = SERVICES[npc.kind as keyof typeof SERVICES];
  if (!service) return refused("uninterested");
  const met = recorded(game, {
    kind: "interacted",
    source: whoIs(game, actor),
    target: whoIs(game, npc),
  });
  return performed(
    service === "bounty"
      ? bountied(met, actor.id, { ...npc, at: npc.at })
      : met,
  );
};

const sell = (
  game: Game,
  customer: Customer,
  trader: Trader,
  item: Item,
): Outcome => {
  const price = offerOf(item);
  if (trader.gold < price) return refused("no-gold");
  return performed(
    recorded(
      updated(
        updated(game, customer.id, {
          pack: customer.pack.filter((held) => held !== item),
          gold: customer.gold + price,
        }),
        trader.id,
        { wares: [...trader.wares, item], gold: trader.gold - price },
      ),
      {
        kind: "sold",
        source: whoIs(game, customer),
        target: whoIs(game, trader),
        item,
        price,
      },
    ),
  );
};

const buy = (
  game: Game,
  customer: Customer,
  trader: Trader,
  item: Item,
): Outcome => {
  const price = priceOf(item);
  const { pack, gold, equipment } = customer;
  if (gold < price) return refused("no-gold");
  if (loadOf(pack) + sizeOf(item) > capacityOf(equipment))
    return refused("full");
  return performed(
    recorded(
      updated(
        updated(game, customer.id, {
          pack: [...pack, item],
          gold: gold - price,
        }),
        trader.id,
        {
          wares: trader.wares.filter((ware) => ware !== item),
          gold: trader.gold + price,
        },
      ),
      {
        kind: "bought",
        source: whoIs(game, customer),
        target: whoIs(game, trader),
        item,
        price,
      },
    ),
  );
};

/** Sells a pack item to an adjacent trader, or buys one of its wares. */
export const trade: Rule<Trade> = (game, deed, actor) => {
  if (!has(actor, "inventory", "purse", "position")) return refused("unable");
  const trader = withOf(game, deed.trader, "wares", "purse", "position");
  if (!trader) return refused("no-target");
  if (!isBeside(game, actor.at, trader.at)) return refused("out-of-reach");
  const isIt = ({ id }: Item) => id === deed.item;
  const sold = actor.pack.find(isIt);
  if (sold) return sell(game, actor, trader, sold);
  const bought = trader.wares.find(isIt);
  return bought ? buy(game, actor, trader, bought) : refused("no-item");
};
