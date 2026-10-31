export const THEME_NAMES = {
  woodcut: "Woodcut",
  classic: "Classic",
} as const;

export type ThemeId = keyof typeof THEME_NAMES;

export const DEFAULT_THEME: ThemeId = "woodcut";

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === "string" && Object.hasOwn(THEME_NAMES, value);

export const themeOf = (json: string): ThemeId => {
  const stored: unknown = JSON.parse(json);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
};
