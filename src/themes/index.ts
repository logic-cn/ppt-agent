import type { Theme } from "@/types/theme";
import businessBlue from "./business-blue.json";
import minimalWhite from "./minimal-white.json";
import techPurple from "./tech-purple.json";
import vibrantOrange from "./vibrant-orange.json";

export const BUILTIN_THEMES: Theme[] = [
  businessBlue as Theme,
  minimalWhite as Theme,
  techPurple as Theme,
  vibrantOrange as Theme,
];

export const DEFAULT_THEME_ID = "business-blue";

export function getTheme(id: string): Theme {
  return BUILTIN_THEMES.find((t) => t.id === id) ?? BUILTIN_THEMES[0];
}

export function resolveTheme(
  themeId: string,
  overrides?: Partial<Theme>,
): Theme {
  const base = getTheme(themeId);
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...overrides.colors },
    fonts: { ...base.fonts, ...overrides.fonts },
    fontSize: { ...base.fontSize, ...overrides.fontSize },
    layouts: { ...base.layouts, ...overrides.layouts },
  };
}
