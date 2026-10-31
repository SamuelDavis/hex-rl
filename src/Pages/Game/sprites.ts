import type { MonsterKind, SpawnerKind } from "../../game/monsters";

export const SPRITE_BOX = 32;
export const SPRITE_FOOT = 30;

export type Tone = "ink" | "bone" | "blood" | "leaf";

export interface Layer {
  readonly tone: Tone | "etch";
  readonly path: string;
}

export type Sprite = readonly Layer[];

export interface Figure {
  readonly sprite: Sprite;
  readonly scale: number;
}

const WOLF: Sprite = [
  {
    tone: "bone",
    path: "M7 13 L13 11.5 L20 12 L23 8.5 L24 4.5 L26 8 L28 9.5 L31 12.5 L29 14.5 L25.5 15 L24.5 18 L24.5 29 L21.5 29 L20.5 21.5 L13 21 L12 29 L9 29 L8.5 20.5 L5 22.5 L1.5 23 L4 19.5 Z",
  },
  { tone: "blood", path: "M24.5 9.5 L27.5 10.2 L25.5 11.4 Z" },
  {
    tone: "etch",
    path: "M27.5 13.6 L30.5 12.6 M13 11.5 L14.5 15 M16.5 12 L17.5 15.5 M19.5 12 L20.5 15 M12 15.5 L12.8 19.5 M15 16 L15.6 20",
  },
];

const HOOD = (cloak: Tone): Sprite => [
  {
    tone: cloak,
    path: "M16 2.5 C10.5 2.5 8.5 8.5 8.5 13 L5 29 L9 27 L11.5 30 L14 27 L16.5 30 L19 27 L21.5 30 L23.5 27 L27 29 L23.5 13 C23.5 8.5 21.5 2.5 16 2.5 Z",
  },
  {
    tone: "ink",
    path: "M16 7.5 C12.5 7.5 11.5 11 12 15 C13 17.5 19 17.5 20 15 C20.5 11 19.5 7.5 16 7.5 Z",
  },
  { tone: "etch", path: "M10.5 20 L9 27 M21.5 20 L23 27 M16 21 L16 28" },
];

const PLAYER: Sprite = [
  ...HOOD("blood"),
  { tone: "bone", path: "M17.2 12 h1.6 v1.4 h-1.6 Z M14 12 h1.6 v1.4 h-1.6 Z" },
  {
    tone: "bone",
    path: "M14.4 20 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 Z",
  },
  { tone: "bone", path: "M24 17 L30 7 L31 8 L25.5 18.5 Z" },
  { tone: "blood", path: "M23 19.5 L22 21.5 L24 22.5 L25 20.5 Z" },
];

const THIEF: Sprite = [
  ...HOOD("bone"),
  {
    tone: "blood",
    path: "M17.2 12 h1.6 v1.4 h-1.6 Z M14 12 h1.6 v1.4 h-1.6 Z",
  },
  { tone: "blood", path: "M23 19 L29.5 13 L30.5 14 L24.5 20.5 Z" },
  { tone: "ink", path: "M22 19 L25 22 L24 23 L21 20 Z" },
];

const BANDIT: Sprite = [
  { tone: "bone", path: "M10 15 L22 15 L25 29 L7 29 Z" },
  { tone: "etch", path: "M8.5 23 L23.5 23 M16 15 L16 29" },
  { tone: "bone", path: "M12 9 L20 9 L20 13 C20 16 12 16 12 13 Z" },
  { tone: "blood", path: "M11.5 12.5 L20.5 12.5 L20.5 15 L16 18 L11.5 15 Z" },
  {
    tone: "ink",
    path: "M13.5 10.5 h1.8 v1.2 h-1.8 Z M16.7 10.5 h1.8 v1.2 h-1.8 Z",
  },
  {
    tone: "ink",
    path: "M5.5 10 L26.5 10 L24.5 7.5 L21 7.5 L20 2.5 L12 2.5 L11 7.5 L7.5 7.5 Z",
  },
  { tone: "bone", path: "M23 23 L29.5 6 L31 6.5 L25.5 23.5 Z" },
  { tone: "blood", path: "M21.5 22 L27 24 L26.5 25.5 L21 23.5 Z" },
];

const KOBOLD_BODY: Sprite = [
  { tone: "blood", path: "M11 17 L21 17 L23 29 L19 29 L16 24 L13 29 L9 29 Z" },
  {
    tone: "bone",
    path: "M9 11 L13 4 L14 9 L19 8.5 L28.5 11.5 L28.5 14 L21 15.5 L23 17.5 L12 18 L9 15 Z",
  },
  { tone: "blood", path: "M17 10.5 L20 11 L18 12.5 Z" },
  { tone: "etch", path: "M21 13.8 L28 13 M24 11 L24.5 13.3" },
];

const KOBOLD: Sprite = [
  ...KOBOLD_BODY,
  { tone: "bone", path: "M3 29 L8 9 L9.5 9.5 L4.5 29.5 Z" },
  { tone: "bone", path: "M3 11 C5 7 11 6 13 8 C10 8.5 7 9.5 4.5 12 Z" },
];

const GOBLIN_HEAD: Sprite = [
  {
    tone: "bone",
    path: "M16 6 C20 6 22 8.5 22 11.5 L30.5 7.5 L24.5 15 C23.5 18 20 19.5 16 19.5 C12 19.5 8.5 18 7.5 15 L1.5 7.5 L10 11.5 C10 8.5 12 6 16 6 Z",
  },
  {
    tone: "blood",
    path: "M12 11.5 L15 12.5 L12.5 13.8 Z M20 11.5 L17 12.5 L19.5 13.8 Z",
  },
  {
    tone: "ink",
    path: "M11.5 15.5 L20.5 15.5 L19.5 17.8 L12.5 17.8 Z",
  },
  {
    tone: "bone",
    path: "M13 15.5 L14 17 L15 15.5 Z M17 15.5 L18 17 L19 15.5 Z",
  },
];

const GOBLIN: Sprite = [
  { tone: "blood", path: "M10 18 L22 18 L24.5 29 L7.5 29 Z" },
  { tone: "etch", path: "M9 24 L23 24" },
  ...GOBLIN_HEAD,
];

const ALPHA_WOLF: Sprite = [
  {
    tone: "bone",
    path: "M6 15 L12 13 L18 13.5 L21 10 L23 5.5 L25 9 L27.5 10 L31.5 13 L30 15.5 L27 15.8 L25.5 18.5 L25 29 L22 29 L21 22 L13 21.5 L12 29 L9 29 L8.5 21 L4.5 24 L1 23.5 L4 20 Z",
  },
  {
    tone: "blood",
    path: "M11 14 L12.5 9.5 L14.5 12.5 L16 8 L17.5 11.5 L19.5 6.5 L21 10 L22.5 5 L24 10 L22.5 15.5 L18.5 17.5 L13 16.5 Z",
  },
  { tone: "ink", path: "M25.5 10.4 L28 11 L26 12 Z" },
  { tone: "ink", path: "M27.5 13.6 L31.8 13.2 L29.5 16 Z" },
  { tone: "etch", path: "M13 18 L13.8 21 M16 18 L16.6 21.5 M19 18 L19.4 21.5" },
];

const BANDIT_CHIEF: Sprite = [
  {
    tone: "blood",
    path: "M9 14 L23 14 L27 29.5 L21.5 27.5 L16 29.5 L10.5 27.5 L5 29.5 Z",
  },
  { tone: "etch", path: "M16 14 L16 21 M12 16 L10.5 26 M20 16 L21.5 26" },
  { tone: "bone", path: "M8.5 21 L23.5 21 L24 23.5 L8 23.5 Z" },
  { tone: "ink", path: "M15 21.5 h2 v1.5 h-2 Z" },
  {
    tone: "bone",
    path: "M12 6 L20 6 L20.5 11 L18.5 14.5 L13.5 14.5 L11.5 11 Z",
  },
  {
    tone: "ink",
    path: "M13.3 8.3 h2.2 v2.2 h-2.2 Z M16.5 8.3 h2.2 v2.2 h-2.2 Z",
  },
  {
    tone: "etch",
    path: "M14 12.8 L18 12.8 M15.3 12 L15.3 13.8 M16.8 12 L16.8 13.8",
  },
  {
    tone: "ink",
    path: "M6.5 8 C10 1.5 22 1.5 25.5 8 L20.5 6.5 L16 8.5 L11.5 6.5 Z",
  },
  { tone: "bone", path: "M24 27.5 L27.5 5.5 L29 5.8 L25.5 27.8 Z" },
  { tone: "blood", path: "M27.8 6.5 C31.5 5.5 32 10.5 31 13.5 L26.9 12 Z" },
];

const GOBLIN_CHIEF: Sprite = [
  { tone: "blood", path: "M8 17 L24 17 L27.5 29.5 L4.5 29.5 Z" },
  { tone: "etch", path: "M11 20 L9 29 M16 20 L16 29 M21 20 L23 29" },
  {
    tone: "bone",
    path: "M11.5 8 L8.5 1.5 L11.2 4.2 L11.8 0.5 L14 6.5 Z M20.5 8 L23.5 1.5 L20.8 4.2 L20.2 0.5 L18 6.5 Z",
  },
  ...GOBLIN_HEAD,
  { tone: "bone", path: "M26.5 30 L27.5 11 L29 11 L28 30 Z" },
  {
    tone: "bone",
    path: "M25 9 C25 5 31.5 5 31.5 9 L30.5 12 L26 12 Z",
  },
  { tone: "ink", path: "M26.3 8 h1.7 v1.7 h-1.7 Z M28.6 8 h1.7 v1.7 h-1.7 Z" },
];

const KOBOLD_FOREMAN: Sprite = [
  ...KOBOLD_BODY,
  {
    tone: "ink",
    path: "M9 11.5 C8.5 6 17.5 4.5 20.5 9.5 L20.5 10.5 L9.5 12.5 Z",
  },
  { tone: "blood", path: "M19 11.6 L21.8 11.9 L19.8 13.2 Z" },
  { tone: "bone", path: "M13.5 6 L13.5 3 L15.5 3 L15.5 6 Z" },
  {
    tone: "blood",
    path: "M14.5 2.8 C13.3 1.8 14.5 0 14.5 0 C15.8 1 15.7 2.2 14.5 2.8 Z",
  },
  { tone: "bone", path: "M4.5 29.5 L6 11 L7.5 11 L6 29.8 Z" },
  { tone: "bone", path: "M1.5 6.5 L11 6.5 L11 11.5 L1.5 11.5 Z" },
  { tone: "etch", path: "M4 6.5 L4 11.5 M8.5 6.5 L8.5 11.5" },
];

const TROLL: Sprite = [
  {
    tone: "bone",
    path: "M6 13 C6 7 11 5 16 7 C21 5 26 7 26 13 L29.5 25 L26 26 L24 19 L23.5 29.5 L18 29.5 L16 23 L14 29.5 L8.5 29.5 L8 19 L6 26 L2.5 25 Z",
  },
  {
    tone: "bone",
    path: "M12 4.5 C12 2 20 2 20 4.5 L20.5 9 C20 12 12 12 11.5 9 Z",
  },
  { tone: "blood", path: "M13.5 5.5 h2 v1.6 h-2 Z M16.5 5.5 h2 v1.6 h-2 Z" },
  { tone: "ink", path: "M13.5 8.5 L18.5 8.5 L18 9.8 L14 9.8 Z" },
  {
    tone: "blood",
    path: "M8 12 C9 10 12 10 12.5 13 C11 14.5 9 14 8 12 Z M19.5 14 C21 12.5 24 13 24 15.5 C22 17 20.5 16 19.5 14 Z M10 21 C11 20 13 20.5 13 22 C12 23 10.5 22.5 10 21 Z",
  },
  { tone: "etch", path: "M14 13 L15 18 M17 13 L17.5 17 M16 23 L16 18" },
];

const TROLL_ELDER: Sprite = [
  {
    tone: "bone",
    path: "M12.5 4.5 L7 0.5 L9 3.5 L3.5 2.5 L8.5 5.8 L4.5 7.5 L11.5 7 Z M19.5 4.5 L25 0.5 L23 3.5 L28.5 2.5 L23.5 5.8 L27.5 7.5 L20.5 7 Z",
  },
  ...TROLL,
  {
    tone: "blood",
    path: "M12.5 9 L19.5 9 L19 13.5 L18 12 L17 15 L16 12.5 L15 15 L14 12 L13 13.5 Z",
  },
];

const DEN: Sprite = [
  {
    tone: "bone",
    path: "M1.5 30 L4 21 L9 15 L16 11.5 L23 13.5 L28.5 20 L30.5 30 Z",
  },
  {
    tone: "etch",
    path: "M9 15 L10.5 19 M16 11.5 L15 15.5 M23 13.5 L22 17 M5 24 L7.5 25 M27 23 L25 25",
  },
  {
    tone: "ink",
    path: "M9 30 C9 22.5 12 19.5 16 19.5 C20 19.5 23 22.5 23 30 Z",
  },
  {
    tone: "blood",
    path: "M13 24 L15 24.5 L13.5 25.5 Z M19 24 L17 24.5 L18.5 25.5 Z",
  },
  { tone: "bone", path: "M2 29 L9 27.5 L9.3 28.5 L2.3 30 Z" },
];

const CAMP: Sprite = [
  { tone: "etch", path: "M13 2 L19 9 M19 2 L13 9" },
  { tone: "blood", path: "M3 30 L16 5 L29 30 Z" },
  { tone: "etch", path: "M9.5 18 L7 30 M22.5 18 L25 30" },
  { tone: "ink", path: "M11.5 30 L16 15.5 L20.5 30 Z" },
  { tone: "bone", path: "M16 15.5 L13 30 L11.5 30 Z" },
];

const VILLAGE: Sprite = [
  { tone: "bone", path: "M6.5 17 L25.5 17 L25.5 30 L6.5 30 Z" },
  { tone: "etch", path: "M10 20 L10 30 M22 20 L22 30" },
  { tone: "ink", path: "M13 30 L13 23 C13 20 19 20 19 23 L19 30 Z" },
  {
    tone: "blood",
    path: "M2.5 19.5 L16 6 L29.5 19.5 L26 21.5 L22.5 19.5 L19 21.5 L16 19.5 L13 21.5 L9.5 19.5 L6 21.5 Z",
  },
  { tone: "etch", path: "M16 9 L16 18 M12 13 L10 18 M20 13 L22 18" },
  { tone: "bone", path: "M16 7 L12.5 1.5 L15 6 Z M16 7 L19.5 1.5 L17 6 Z" },
];

const MINE: Sprite = [
  { tone: "ink", path: "M8 30 L8 11 L24 11 L24 30 Z" },
  {
    tone: "bone",
    path: "M10 27.5 h12 v2.5 h-12 Z M11 23.5 h10 v2 h-10 Z M12 19.5 h8 v2 h-8 Z M13 15.5 h6 v2 h-6 Z",
  },
  { tone: "bone", path: "M5 30 L5.5 10 L9 10 L9.5 30 Z" },
  { tone: "bone", path: "M22.5 30 L23 10 L26.5 10 L27 30 Z" },
  { tone: "bone", path: "M3 7 L29 7.5 L29 11.5 L3 11 Z" },
  {
    tone: "etch",
    path: "M7 15 L7.5 21 M25 14 L24.8 20 M10 9 L15 9.2 M19 9.2 L26 9.4",
  },
];

const CAVE: Sprite = [
  {
    tone: "bone",
    path: "M1 30 L3.5 17 C6 5 26 5 28.5 17 L31 30 Z",
  },
  {
    tone: "etch",
    path: "M4 21 L8.5 21.5 M5.5 14 L10 16.5 M11 8.5 L13 13 M21 8.5 L19 13 M26.5 14 L22 16.5 M28 21 L23.5 21.5 M16 7 L16 12",
  },
  {
    tone: "ink",
    path: "M9 30 L9 20 C9 12.5 23 12.5 23 20 L23 30 Z",
  },
  {
    tone: "blood",
    path: "M12.5 21 L15 21.6 L13 22.8 Z M19.5 21 L17 21.6 L19 22.8 Z",
  },
];

export const TREE: Sprite = [
  {
    tone: "bone",
    path: "M14.5 30 L15 19 L10.5 14.5 L12 13.5 L15.5 16.5 L16.5 11 L18.5 11 L18 17 L21 14 L22.5 15 L18.5 20 L18.5 30 Z",
  },
  {
    tone: "leaf",
    path: "M16 1.5 L20 3.5 L25 3.5 L27 7.5 L30.5 10.5 L28.5 14.5 L24 16.5 L19.5 15.5 L16 17.5 L12 15.5 L7 16.5 L3.5 13.5 L2.5 9.5 L6 5.5 L11 4.5 Z",
  },
  {
    tone: "etch",
    path: "M9 9 L12 11 M20 7 L22.5 9.5 M15 10 L16 12.5 M24 11.5 L25.5 13",
  },
  { tone: "etch", path: "M15.8 22 L17.5 23 M15.6 26 L17 27" },
];

export const CONIFER: Sprite = [
  { tone: "bone", path: "M14.5 22 L17.5 22 L18 30 L14 30 Z" },
  {
    tone: "leaf",
    path: "M16 1 L20.5 8.5 L18.5 8.5 L23.5 15.5 L20.5 15.5 L26.5 23.5 L5.5 23.5 L11.5 15.5 L8.5 15.5 L13.5 8.5 L11.5 8.5 Z",
  },
  { tone: "etch", path: "M13 12 L16 10.5 L19 12 M11 19 L16 17 L21 19" },
];

export const CHEST: Sprite = [
  { tone: "blood", path: "M5.5 17 L26.5 17 L26.5 29 L5.5 29 Z" },
  {
    tone: "blood",
    path: "M5.5 17 L5.5 13 C5.5 8.5 26.5 8.5 26.5 13 L26.5 17 Z",
  },
  { tone: "bone", path: "M5.5 16 L26.5 16 L26.5 18.5 L5.5 18.5 Z" },
  {
    tone: "bone",
    path: "M8.5 10.5 L11.5 10 L11.5 29 L8.5 29 Z M20.5 10 L23.5 10.5 L23.5 29 L20.5 29 Z",
  },
  { tone: "bone", path: "M14 14.5 L18 14.5 L18 21 L14 21 Z" },
  { tone: "ink", path: "M15.3 16.5 h1.4 v3 h-1.4 Z" },
];

export const PLAYER_FIGURE: Figure = { sprite: PLAYER, scale: 1 };

export const MONSTER_FIGURES: Record<MonsterKind, Figure> = {
  wolf: { sprite: WOLF, scale: 1 },
  cub: { sprite: WOLF, scale: 0.7 },
  bandit: { sprite: BANDIT, scale: 1 },
  thief: { sprite: THIEF, scale: 0.85 },
  kobold: { sprite: KOBOLD, scale: 0.8 },
  goblin: { sprite: GOBLIN, scale: 0.9 },
  troll: { sprite: TROLL, scale: 1.2 },
  "alpha wolf": { sprite: ALPHA_WOLF, scale: 1.3 },
  "bandit chief": { sprite: BANDIT_CHIEF, scale: 1.2 },
  "goblin chief": { sprite: GOBLIN_CHIEF, scale: 1.15 },
  "kobold foreman": { sprite: KOBOLD_FOREMAN, scale: 1 },
  "troll elder": { sprite: TROLL_ELDER, scale: 1.4 },
};

export const SPAWNER_SPRITES: Record<SpawnerKind, Sprite> = {
  den: DEN,
  camp: CAMP,
  village: VILLAGE,
  mine: MINE,
  cave: CAVE,
};
