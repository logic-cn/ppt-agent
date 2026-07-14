import type { Theme } from "@/types/theme";
import type { VisualStyleId } from "@/types/design";
import { getPalette, PALETTES } from "@/design/palettes";
import { getVisualStyle } from "@/design/visual-styles";
import { DEFAULT_DESIGN } from "@/types/design";

export const DEFAULT_THEME_ID = DEFAULT_DESIGN.palette;
export const CUSTOM_THEME_PREFIX = "custom-";

// 全局自定义主题缓存，由 useCustomThemeStore 在加载时填充
let _customThemes: Theme[] = [];

export function setCustomThemes(themes: Theme[]) {
  _customThemes = themes;
}

export function getCustomThemes(): Theme[] {
  return _customThemes;
}

/**
 * Theme 不再单独存储，统一由 (palette, visualStyle) 派生：
 * - colors 来自统一 palette 注册表（内置 + 自定义）
 * - fonts / fontSize / spacing 来自 VISUAL_STYLES
 */
export function resolveTheme(
  paletteId: string,
  visualStyleId: VisualStyleId,
): Theme {
  const palette = getPalette(paletteId) ?? getPalette(DEFAULT_DESIGN.palette)!;
  const style =
    getVisualStyle(visualStyleId) ??
    getVisualStyle(DEFAULT_DESIGN.visualStyle)!;
  return {
    id: palette.id,
    name: palette.name,
    colors: palette.colors,
    fonts: style.fonts,
    fontSize: style.fontSize,
    spacing: style.spacing,
  };
}

// 由统一 palette 注册表派生，不再维护重复的主题注册表
export const BUILTIN_THEMES: Theme[] = PALETTES.map((p) =>
  resolveTheme(p.id, DEFAULT_DESIGN.visualStyle),
);

export function getAllThemes(): Theme[] {
  return [...BUILTIN_THEMES, ..._customThemes];
}

export function getTheme(id: string): Theme {
  return (
    (getPalette(id)
      ? resolveTheme(id, DEFAULT_DESIGN.visualStyle)
      : undefined) ??
    _customThemes.find((t) => t.id === id) ??
    BUILTIN_THEMES[0]!
  );
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
  };
}
