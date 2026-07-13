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

export const DEFAULT_THEME_ID = "vibrant-orange";
export const CUSTOM_THEME_PREFIX = "custom-";

// 全局自定义主题缓存，由 useCustomThemeStore 在加载时填充
let _customThemes: Theme[] = [];

export function setCustomThemes(themes: Theme[]) {
  _customThemes = themes;
}

export function getCustomThemes(): Theme[] {
  return _customThemes;
}

export function getAllThemes(): Theme[] {
  return [...BUILTIN_THEMES, ..._customThemes];
}

export function getTheme(id: string): Theme {
  return (
    BUILTIN_THEMES.find((t) => t.id === id) ??
    _customThemes.find((t) => t.id === id) ??
    BUILTIN_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
  );
}

export function resolveTheme(
  themeKey: string,
  overrides?: Partial<Theme>,
): Theme {
  const base = getTheme(themeKey);
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

export function cloneThemeFrom(
  base: Theme,
  newId: string,
  newName: string,
): Theme {
  return {
    ...base,
    id: newId,
    name: newName,
    colors: { ...base.colors },
    fonts: { ...base.fonts },
    fontSize: { ...base.fontSize },
    layouts: JSON.parse(JSON.stringify(base.layouts)) as typeof base.layouts,
  };
}
