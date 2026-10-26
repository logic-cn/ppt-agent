import type { DesignLock } from "./design";
import type { SlideLayout } from "./layouts";

export type { SlideLayout } from "./layouts";

export type ChartType = "bar" | "pie" | "line" | "doughnut";

export type ImagePosition = "full" | "right" | "background";
/**
 * 图片来源单一事实源（参照 SLIDE_LAYOUTS）：deck-schema / deck-patch 的枚举
 * 都从这里派生，禁止再手写列表——分叉会让 AI patch 无法写入合法来源值。
 */
export const IMAGE_SOURCES = ["ai", "icon", "url", "web"] as const;

export type ImageSource = (typeof IMAGE_SOURCES)[number];

/** 幻灯片转场样式（D1 放映效果，none=不加转场） */
export type TransitionStyle = "none" | "fade" | "push" | "wipe" | "cut";

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
  /** 网络图片来源署名（B7 网络搜图，导出时建议保留） */
  attribution?: string;
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
  /**
   * SVG 过期标记：svg 存在，但其结构化内容（标题/要点/图表等）在生成后被编辑，
   * 预览与导出中的 SVG 已不能反映当前内容，需提示用户重画同步。
   */
  svgStale?: boolean;
}

/**
 * 影响 SVG 视觉呈现的结构化字段：编辑这些字段后，已有的 SVG 不再反映当前内容。
 * notes / sourceRefs 不参与 SVG 视觉，编辑不触发过期。
 * 被 store 的 updateSlide 与 deck-patch / auto-fix 等编辑路径共用。
 */
export const SVG_VISUAL_FIELDS = [
  "title",
  "subtitle",
  "body",
  "bullets",
  "items",
  "elements",
  "chart",
  "image",
  "metric",
  "quote",
  "attribution",
  "layout",
] as const;

/** patch 是否触及影响 SVG 视觉的结构化字段 */
export function touchesSvgVisual(patch: Record<string, unknown>): boolean {
  const allowed = SVG_VISUAL_FIELDS as readonly string[];
  return Object.keys(patch).some((k) => allowed.includes(k));
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
  source?: {
    type: DeckSource;
    ref: string;
  }; /** 转场样式（导出时注入 OOXML，缺省 none 不注入） */
  transition?: TransitionStyle;
  /** 对象入场动画（逐形状淡入，单击推进；缺省关闭） */
  entranceAnimation?: boolean;
}

export interface DeckMeta {
  id: string;
  title: string;
  slidesCount: number;
  createdAt: number;
  updatedAt: number;
}
