/**
 * SlideLayout 单一事实源。
 *
 * 全项目的布局枚举都从这里派生（deck-schema / outline / deck-patch / deck-repair），
 * 禁止在任何地方再手写一份布局列表，避免分叉导致数据丢失或校验不一致。
 */
export const SLIDE_LAYOUTS = [
  "cover",
  "section",
  "content",
  "two-column",
  "chart",
  "image",
  "closing",
  // 多列/多项内容布局
  "cols-2",
  "cols-3",
  "cols-4",
  "cols-5",
  "cols-6",
  // 语义化专用布局（参考 dashi-ppt layout-roles）
  "metrics", // 核心数字海报
  "quote", // 金句 / 核心论点
  "timeline", // 时间线 / 阶段走势
] as const;

export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export function isSlideLayout(v: unknown): v is SlideLayout {
  return (
    typeof v === "string" && (SLIDE_LAYOUTS as readonly string[]).includes(v)
  );
}
