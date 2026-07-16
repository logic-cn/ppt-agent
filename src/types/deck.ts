import type { DesignLock } from "./design";

export type SlideLayout =
  | "cover"
  | "section"
  | "content"
  | "two-column"
  | "chart"
  | "image"
  | "closing"
  // 多列/多项内容布局
  | "cols-2"
  | "cols-3"
  | "cols-4"
  | "cols-5"
  | "cols-6"
  // 语义化专用布局（参考 dashi-ppt layout-roles）
  | "metrics" // 核心数字海报
  | "quote" // 金句 / 核心论点
  | "timeline"; // 时间线 / 阶段走势

export type ChartType = "bar" | "pie" | "line" | "doughnut";

export type ImagePosition = "full" | "right" | "background";
export type ImageSource = "ai" | "icon" | "url";

export interface BulletNode {
  id: string;
  text: string;
  level: 0 | 1 | 2;
  children?: BulletNode[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSpec {
  type: ChartType;
  title?: string;
  data: ChartDataPoint[];
}

export interface ImageSpec {
  type: ImageSource;
  prompt?: string;
  url?: string;
  alt: string;
  position?: ImagePosition;
}

export interface SlideElement {
  id: string;
  type: "text" | "image" | "chart" | "shape";
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
}

export interface SlideContentItem {
  id: string;
  title?: string;
  bullets?: string[];
  body?: string;
}

export interface SlideSourceRef {
  sourceId: string;
  sectionId?: string;
  chunkId?: string;
  quote?: string;
}

export interface MetricSpec {
  /** 主数值，如 "970" 或 "98.6" */
  value: string;
  /** 单位，如 "亿美元" "%" */
  unit?: string;
  /** 数值下方说明文案 */
  label: string;
  /** 可选强调前缀，如 "突破" */
  kicker?: string;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: BulletNode[];
  items?: SlideContentItem[];
  elements?: SlideElement[];
  chart?: ChartSpec;
  image?: ImageSpec;
  metric?: MetricSpec;
  quote?: string;
  attribution?: string;
  notes?: string;
  sourceRefs?: SlideSourceRef[];
  /** X1 链路：由 executor 逐页生成的设计真相 SVG（viewBox="0 0 1280 720"） */
  svg?: string;
}

export type DeckSource = "topic" | "doc" | "url";

export interface Deck {
  id: string;
  version: number;
  title: string;
  design: DesignLock;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
  source?: { type: DeckSource; ref: string };
}

export interface DeckMeta {
  id: string;
  title: string;
  slidesCount: number;
  createdAt: number;
  updatedAt: number;
}
