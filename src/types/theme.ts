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
  /** metrics 布局：超大数值区 */
  metric?: Rect;
  /** quote 布局：引述文本区 */
  quote?: Rect;
  /** quote 布局：署名/出处区 */
  attribution?: Rect;
  /** timeline 布局：时间轴基线 */
  timeline?: Rect;
}

export interface ThemeDecor {
  /** 封面/章节/结尾页的强调装饰形态 */
  coverAccent: "top-bar" | "side-bar" | "corner" | "none";
  /** 正文页左侧栏目装饰形态 */
  bodyAccent: "side-bar" | "none";
  /** 分隔线形态 */
  separator: "line" | "none";
  /** 是否显示背景网格（科技/工程风） */
  grid?: boolean;
  /** 装饰元素形状圆角（比例值） */
  accentRadius?: number;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  fontSize: ThemeFontSize;
  spacing: Spacing;
  /** 页面级装饰差异化配置；缺省时使用通用默认装饰 */
  decor?: ThemeDecor;
}
