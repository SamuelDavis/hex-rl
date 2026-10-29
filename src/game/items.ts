import type { Rng } from "procgen";
import { rngOf } from "procgen";
import { MONSTERS, type MonsterKind } from "./monsters";

export const BASE_CAPACITY = 6;

export type Wear = "helm" | "chest" | "pants" | "boots" | "gloves" | "bag";

interface Gear {
  readonly wear: Wear;
  readonly size: number;
  /** Pack capacity added while equipped. */
  readonly capacity?: number;
  readonly bases: readonly string[];
  readonly materials: readonly string[];
}

const BAG_MATERIALS = ["cloth", "leather", "burlap", "canvas"];

export const GEAR = {
  helm: {
    wear: "helm",
    size: 1,
    bases: ["helm", "cap", "coif"],
    materials: ["leather", "iron", "chain", "bronze"],
  },
  chest: {
    wear: "chest",
    size: 3,
    bases: ["shirt", "vest", "jerkin", "hauberk"],
    materials: ["leather", "chain", "padded", "scale"],
  },
  pants: {
    wear: "pants",
    size: 2,
    bases: ["pants", "leggings", "greaves"],
    materials: ["leather", "chain", "wool", "iron"],
  },
  boots: {
    wear: "boots",
    size: 1,
    bases: ["boots", "shoes", "sandals"],
    materials: ["leather", "chain", "hide", "iron"],
  },
  gloves: {
    wear: "gloves",
    size: 1,
    bases: ["gloves", "gauntlets", "mitts"],
    materials: ["leather", "chain", "wool", "iron"],
  },
  "small bag": {
    wear: "bag",
    size: 0,
    capacity: 2,
    bases: ["pouch", "small bag"],
    materials: BAG_MATERIALS,
  },
  bag: {
    wear: "bag",
    size: 0,
    capacity: 4,
    bases: ["bag", "satchel"],
    materials: BAG_MATERIALS,
  },
  "large bag": {
    wear: "bag",
    size: 0,
    capacity: 6,
    bases: ["large bag", "rucksack"],
    materials: BAG_MATERIALS,
  },
} as const satisfies Record<string, Gear>;

export type GearKind = keyof typeof GEAR;

export const POTION_KINDS = ["health", "mana"] as const;

export type PotionKind = (typeof POTION_KINDS)[number];

export const isPotion = (name: string): name is PotionKind =>
  (POTION_KINDS as readonly string[]).includes(name);

export interface Name {
  readonly prefix?: string;
  readonly base: string;
  readonly suffix?: string;
}

export type Item =
  | {
      readonly id: string;
      readonly kind: "potion";
      readonly potion: PotionKind;
    }
  | {
      readonly id: string;
      readonly kind: "gear";
      readonly gear: GearKind;
      readonly name: Name;
    };

export interface Chest {
  readonly gold: number;
  readonly items: readonly Item[];
}

export const PLACES = {
  helm: "helm",
  chest: "chest",
  pants: "pants",
  boots: "boots",
  gloves: "gloves",
  "bag 1": "bag",
  "bag 2": "bag",
  "bag 3": "bag",
} as const satisfies Record<string, Wear>;

/** A paper-doll position. */
export type Place = keyof typeof PLACES;

export const PLACE_NAMES = Object.keys(PLACES) as readonly Place[];

export type Equipment = Readonly<Partial<Record<Place, Item>>>;

export const nameOf = (item: Item): string => {
  if (item.kind === "potion") return `${item.potion} potion`;
  const { prefix, base, suffix } = item.name;
  return [prefix, base, suffix].filter(Boolean).join(" ");
};

export const fits = (item: Item, place: Place): boolean =>
  item.kind === "gear" && GEAR[item.gear].wear === PLACES[place];

/** Where equipping `item` puts it: an empty place if any, else the first worn one, swapped. */
export const placeFor = (
  item: Item,
  equipment: Equipment,
): Place | undefined => {
  const fitting = PLACE_NAMES.filter((place) => fits(item, place));
  return fitting.find((place) => !equipment[place]) ?? fitting[0];
};

export const sizeOf = (item: Item): number =>
  item.kind === "gear" ? GEAR[item.gear].size : 0;

export const loadOf = (items: readonly Item[]): number =>
  items.reduce((load, item) => load + sizeOf(item), 0);

const capacityAddedBy = (item: Item): number =>
  item.kind === "gear" ? ((GEAR[item.gear] as Gear).capacity ?? 0) : 0;

export const capacityOf = (equipment: Equipment): number =>
  Object.values(equipment).reduce(
    (capacity, item) => capacity + capacityAddedBy(item),
    BASE_CAPACITY,
  );

/** Spills the largest items, ties broken by `rng`, until `capacity` holds the rest. */
export const overflowOf = (
  items: readonly Item[],
  capacity: number,
  rng: Rng,
): { readonly kept: readonly Item[]; readonly spilled: readonly Item[] } => {
  const spillOrder = rng
    .shuffle(items, 0)
    .sort((a, b) => sizeOf(b) - sizeOf(a));
  const spilled: Item[] = [];
  for (const item of spillOrder) {
    if (loadOf(items) - loadOf(spilled) <= capacity) break;
    spilled.push(item);
  }
  return { kept: items.filter((item) => !spilled.includes(item)), spilled };
};

const ITEM_WEIGHTS: readonly (readonly [PotionKind | GearKind, number])[] = [
  ["health", 4],
  ["mana", 4],
  ["helm", 1],
  ["chest", 1],
  ["pants", 1],
  ["boots", 1],
  ["gloves", 1],
  ["small bag", 0.6],
  ["bag", 0.3],
  ["large bag", 0.1],
];

const PREFIX_CHANCE = 0.75;

const itemOf = (rng: Rng, id: string, source: MonsterKind): Item => {
  const kind = rng.weighted(ITEM_WEIGHTS, 0);
  if (isPotion(kind)) return { id, kind: "potion", potion: kind };
  const { bases, materials } = GEAR[kind];
  const prefix = rng.chance(PREFIX_CHANCE, 1)
    ? rng.pick(materials, 2)
    : undefined;
  return {
    id,
    kind: "gear",
    gear: kind,
    name: {
      ...(prefix && { prefix }),
      base: rng.pick(bases, 3),
      suffix: `of the ${source}`,
    },
  };
};

export const lootOf = (
  seed: number,
  { id, kind }: { readonly id: string; readonly kind: MonsterKind },
): Chest | undefined => {
  const rng = rngOf(seed, "loot").child(id);
  const { gold, items } = MONSTERS[kind];
  const amount = rng.chance(gold.chance, 0)
    ? rng.int(gold.min, gold.max, 1)
    : 0;
  const dropped = Array.from({ length: items.rolls }, (_, roll) => roll)
    .filter((roll) => rng.chance(items.chance, 2, roll))
    .map((roll) => itemOf(rng.child(roll), `${id}/${roll}`, kind));
  if (amount === 0 && dropped.length === 0) return undefined;
  return { gold: amount, items: dropped };
};
