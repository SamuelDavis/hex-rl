import type { Vec2 } from "procgen";

export const PIXELS_PER_UNIT = 20;
export const TILT = 0.7;
export const TOKEN_SIZE = PIXELS_PER_UNIT * 0.5;
export const HAIRLINE = 0.6;
export const MARK_WIDTH = 2;

export type Hsl = readonly [hue: number, saturation: number, lightness: number];

export type Tint = (color: Hsl) => Hsl;

export const css = ([h, s, l]: Hsl, shade = 0) =>
  `hsl(${h} ${s}% ${Math.min(100, Math.max(0, l + shade))}%)`;

export const remembered: Tint = ([h, s, l]) => [h, s * 0.3, l * 0.55];

export const ashen: Tint = ([h, , l]) => [h, 0, l];

export const polyline = (
  context: CanvasRenderingContext2D,
  points: readonly Vec2[],
) => {
  context.beginPath();
  points.forEach(({ x, y }) => context.lineTo(x, y));
};

export const drawEllipse = (
  context: CanvasRenderingContext2D,
  { x, y }: Vec2,
  radius: number,
) => {
  context.beginPath();
  context.ellipse(x, y, radius, radius * TILT, 0, 0, 2 * Math.PI);
};

export const drawLabel = (
  context: CanvasRenderingContext2D,
  { x, y }: Vec2,
  text: string,
  {
    font,
    fill,
    halo,
    width,
  }: {
    readonly font: string;
    readonly fill: string;
    readonly halo: string;
    readonly width: number;
  },
) => {
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = width;
  context.strokeStyle = halo;
  context.fillStyle = fill;
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
  context.lineWidth = HAIRLINE;
};

/** Where a token's level label sits: below and right of its footprint. */
export const levelSpotOf = ({ x, y }: Vec2): Vec2 => ({
  x: x + TOKEN_SIZE,
  y: y + TOKEN_SIZE * TILT,
});

export const drawChevron = (
  context: CanvasRenderingContext2D,
  center: Vec2,
  heading: Vec2,
  { line, halo }: { readonly line: string; readonly halo: string },
) => {
  const at = (along: number, across: number) => ({
    x: center.x + TOKEN_SIZE * (heading.x * along - heading.y * across),
    y: center.y + TOKEN_SIZE * (heading.y * along + heading.x * across),
  });
  polyline(context, [at(1.25, -0.55), at(1.75, 0), at(1.25, 0.55)]);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = halo;
  context.lineWidth = 5;
  context.stroke();
  context.strokeStyle = line;
  context.lineWidth = 2.5;
  context.stroke();
  context.lineWidth = HAIRLINE;
};
