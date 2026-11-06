import type { Rect } from "./types";

export function getColumnRects(bodyRect: Rect, colCount: number): Rect[] {
  const gap = 0.02;
  const totalGap = gap * (colCount - 1);
  const colW = (bodyRect.w - totalGap) / colCount;
  return Array.from({ length: colCount }, (_, i) => ({
    x: bodyRect.x + (colW + gap) * i,
    y: bodyRect.y,
    w: colW,
    h: bodyRect.h,
  }));
}

export function isColsLayout(layout: string): boolean {
  return /^cols-(\d+)$/.test(layout);
}

export function getColCount(layout: string): number {
  const match = layout.match(/^cols-(\d+)$/);
  return match ? parseInt(match[1]) : 0;
}

export function rectToCss(rect: Rect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}
