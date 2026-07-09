import type { Rect, Theme } from "@/types/theme";

/** 将比例坐标 (0~1) 转为 CSS 百分比样式 */
export function rectToStyle(rect: Rect): React.CSSProperties {
  return {
    position: "absolute",
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}

/** 根据 spacing 返回内容内边距比例 */
export function spacingPadding(spacing: Theme["spacing"]): {
  px: number;
  py: number;
} {
  switch (spacing) {
    case "compact":
      return { px: 0.02, py: 0.01 };
    case "airy":
      return { px: 0.04, py: 0.03 };
    default:
      return { px: 0.03, py: 0.02 };
  }
}

/** 安全的文本截断（用于预览溢出提示） */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}
