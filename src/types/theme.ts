export type Spacing = "compact" | "comfortable" | "airy";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
}

export interface ThemeFonts {
  title: string;
  body: string;
}

export interface ThemeFontSize {
  h1: number;
  h2: number;
  body: number;
  caption: number;
}

export interface Rect {
  /** 相对 16:9 画布的比例坐标 (0~1) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutSpec {
  title?: Rect;
  body?: Rect;
  visual?: Rect;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  fontSize: ThemeFontSize;
  spacing: Spacing;
}
