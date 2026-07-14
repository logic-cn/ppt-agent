import type { Theme } from "@/types/theme";
import type { VisualStyleId } from "@/types/design";
import { getPalette } from "@/design/palettes";
import { getVisualStyle } from "@/design/visual-styles";
import { DEFAULT_DESIGN } from "@/types/design";

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
