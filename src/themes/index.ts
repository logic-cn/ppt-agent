import type { Theme, ThemeDecor } from "@/types/theme";
import type { VisualStyleId } from "@/types/design";
import { getPalette } from "@/design/palettes";
import { getVisualStyle } from "@/design/visual-styles";
import { DEFAULT_DESIGN } from "@/types/design";

/**
 * 各视觉风格对应的页面级装饰差异化配置。
 * 让不同主题在装饰层呈现统一但各异的视觉语言，增强「成套感」。
 */
const DECOR_BY_STYLE: Record<VisualStyleId, ThemeDecor> = {
  "swiss-minimal": {
    coverAccent: "top-bar",
    bodyAccent: "none",
    separator: "line",
    accentRadius: 0,
  },
  "dark-tech": {
    coverAccent: "side-bar",
    bodyAccent: "side-bar",
    separator: "line",
    grid: true,
    accentRadius: 0.003,
  },
  "soft-rounded": {
    coverAccent: "corner",
    bodyAccent: "side-bar",
    separator: "none",
    accentRadius: 0.01,
  },
  editorial: {
    coverAccent: "top-bar",
    bodyAccent: "side-bar",
    separator: "line",
    accentRadius: 0,
  },
  blueprint: {
    coverAccent: "side-bar",
    bodyAccent: "side-bar",
    separator: "line",
    grid: true,
    accentRadius: 0.002,
  },
  glassmorphism: {
    coverAccent: "corner",
    bodyAccent: "none",
    separator: "none",
    accentRadius: 0.02,
  },
  "magazine-bold": {
    coverAccent: "top-bar",
    bodyAccent: "none",
    separator: "line",
    accentRadius: 0,
  },
  "ink-wash": {
    coverAccent: "side-bar",
    bodyAccent: "none",
    separator: "line",
    accentRadius: 0.002,
  },
  "pastel-soft": {
    coverAccent: "corner",
    bodyAccent: "side-bar",
    separator: "none",
    accentRadius: 0.02,
  },
  "data-dense": {
    coverAccent: "top-bar",
    bodyAccent: "side-bar",
    separator: "line",
    grid: true,
    accentRadius: 0,
  },
  "nature-calm": {
    coverAccent: "corner",
    bodyAccent: "none",
    separator: "line",
    accentRadius: 0.008,
  },
  "mono-luxury": {
    coverAccent: "top-bar",
    bodyAccent: "none",
    separator: "line",
    accentRadius: 0,
  },
};

/**
 * Theme 不再单独存储，统一由 (palette, visualStyle) 派生：
 * - colors 来自统一 palette 注册表（内置 + 自定义）
 * - fonts / fontSize / spacing 来自 VISUAL_STYLES
 * - decor 来自各视觉风格的装饰配置
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
    decor:
      DECOR_BY_STYLE[visualStyleId] ??
      DECOR_BY_STYLE[DEFAULT_DESIGN.visualStyle],
  };
}
