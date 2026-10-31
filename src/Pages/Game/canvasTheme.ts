import type { Vec2 } from "procgen";
import type { Creature } from "../../game/game";
import type { CreatureKind, SpawnerKind } from "../../game/creatures";
import type { Biome, Tile } from "../../game/terrain";
import type { ThemeId } from "../../theme";
import type { Hsl, Tint } from "./paint";
import { CLASSIC } from "./themes/classic";
import { WOODCUT } from "./themes/woodcut";

/** How a creature regards the player: friendly townsfolk, else a monster's mind state. */
export type Disposition = Creature["mind"]["state"] | "friendly";

export interface Marks {
  readonly watched: string;
  readonly watchedEdge: string;
  readonly targeted: string;
  readonly aimed: string;
  readonly aimArea: string;
}

/** A hex's top face, drawn; `rim` and `drop` describe its visible cliff, if any. */
export interface Ground {
  readonly tile: Tile;
  readonly color: Hsl;
  readonly face: readonly Vec2[];
  readonly base: Vec2;
  readonly cliff?: { readonly rim: readonly Vec2[]; readonly drop: number };
}

/** How the canvas paints a scene; `drawScene` owns geometry, a theme owns appearance. */
export interface CanvasTheme {
  readonly fog: Hsl;
  readonly marks: Marks;
  readonly groundOf: (tile: Tile) => Hsl;
  readonly edgeOf: (ground: Hsl) => string;
  readonly carve: (context: CanvasRenderingContext2D, ground: Ground) => void;
  readonly tree: (
    context: CanvasRenderingContext2D,
    base: Vec2,
    biome: Biome,
    tint: Tint,
  ) => void;
  /** `biome` is where it stands; towns take on its look. */
  readonly spawner: (
    context: CanvasRenderingContext2D,
    base: Vec2,
    kind: SpawnerKind,
    biome: Biome,
    tint: Tint,
  ) => void;
  readonly chest: (context: CanvasRenderingContext2D, base: Vec2) => void;
  /** Marks the lair of the player's outstanding bounty, over its spawner. */
  readonly bounty: (context: CanvasRenderingContext2D, base: Vec2) => void;
  readonly player: (
    context: CanvasRenderingContext2D,
    base: Vec2,
    heading: Vec2,
  ) => void;
  readonly creature: (
    context: CanvasRenderingContext2D,
    base: Vec2,
    kind: CreatureKind,
    disposition: Disposition,
    heading: Vec2,
  ) => void;
  readonly unknown: (context: CanvasRenderingContext2D, base: Vec2) => void;
  readonly level: (
    context: CanvasRenderingContext2D,
    base: Vec2,
    level: number,
  ) => void;
}

export const CANVAS_THEMES: Record<ThemeId, CanvasTheme> = {
  woodcut: WOODCUT,
  classic: CLASSIC,
};
