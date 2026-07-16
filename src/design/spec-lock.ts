import type { DesignLock } from "@/types/design";
import { getVisualStyle } from "./visual-styles";
import { getPalette } from "./palettes";

export interface SpecLock {
  canvas: { w: number; h: number };
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
  style: string;
  icons: string[];
}

export function buildSpecLock(design: DesignLock): SpecLock {
  const style = getVisualStyle(design.visualStyle)!;
  const palette = getPalette(design.palette)!;
  const c = palette.colors;
  return {
    canvas: { w: 1280, h: 720 },
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
    style: design.visualStyle,
    icons: [],
  };
}
