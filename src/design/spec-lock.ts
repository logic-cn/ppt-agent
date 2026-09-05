import type { DesignLock } from "@/types/design";
import { getCanvasFormat } from "@/types/canvas";
import { getVisualStyle } from "./visual-styles";
import { getPalette } from "./palettes";

export interface SpecLock {
  canvas: { w: number; h: number };
  /** 画布格式 id（translator 据此换算 PPTX 版面）；缺省 16:9 */
  canvasFormat?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  fonts: { title: string; body: string };
  /**
   * 全 deck 字号锚点（参照 PPT Master typography anchors）：
   * 同层级文本跨页使用同一字号，单处允许 ±2px 微调，
   * 装饰性例外全页不超过 2 处——保证跨页排版质感一致。
   */
  typography?: {
    /** 页面主标题（对应视觉风格 h1） */
    title: number;
    /** 章节标题/卡片标题（h2） */
    section: number;
    /** 正文与要点 */
    body: number;
    /** 注释/来源/页脚 */
    caption: number;
    /** 核心数字/金句等特大字 */
    hero: number;
  };
  style: string;
  icons: string[];
}

export function buildSpecLock(design: DesignLock): SpecLock {
  const style = getVisualStyle(design.visualStyle)!;
  const palette = getPalette(design.palette)!;
  const c = palette.colors;
  const fs = style.fontSize;
  const canvas = getCanvasFormat(design.canvasFormat);
  return {
    canvas: { w: canvas.w, h: canvas.h },
    canvasFormat: canvas.id,
    colors: {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      background: c.background,
      surface: c.surface,
      text: c.text,
      textMuted: c.textMuted,
    },
    fonts: { title: style.fonts.title, body: style.fonts.body },
    typography: {
      title: fs.h1,
      section: fs.h2,
      body: fs.body,
      caption: fs.caption,
      // 特大数字：主标题的 ~1.8 倍，用于 KPI hero number / 金句
      hero: Math.round(fs.h1 * 1.8),
    },
    style: design.visualStyle,
    icons: [],
  };
}
