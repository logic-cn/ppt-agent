import type { Rect } from "@/types/theme";

export function isColsLayout(layout: string): boolean {
  return layout.startsWith("cols-");
}

export function getColCount(layout: string): number {
  const m = layout.match(/cols-(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

export function getColumnRects(body: Rect, numCols: number): Rect[] {
  const gap = 0.025;
  const colW = (body.w - gap * (numCols - 1)) / numCols;
  const rects: Rect[] = [];
  for (let i = 0; i < numCols; i++) {
    rects.push({
      x: body.x + i * (colW + gap),
      y: body.y,
      w: colW,
      h: body.h,
    });
  }
  return rects;
}
