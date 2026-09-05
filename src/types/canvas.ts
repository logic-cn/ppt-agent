/**
 * 画布格式注册表（参照 PPT Master canvas-formats）。
 * SVG viewBox 像素是页面几何唯一真值；PPTX 版面尺寸 = 像素 / 96 英寸。
 */

export type CanvasFormatId = "ppt-16-9" | "xhs-3-4" | "square-1-1";

export interface CanvasFormat {
  id: CanvasFormatId;
  /** SVG viewBox 宽（px） */
  w: number;
  /** SVG viewBox 高（px） */
  h: number;
}

export const CANVAS_FORMATS: CanvasFormat[] = [
  { id: "ppt-16-9", w: 1280, h: 720 },
  { id: "xhs-3-4", w: 1080, h: 1440 },
  { id: "square-1-1", w: 1080, h: 1080 },
];

export const DEFAULT_CANVAS_FORMAT_ID: CanvasFormatId = "ppt-16-9";

/** SVG 像素 → PPTX 英寸（96px = 1in，所有格式统一） */
export const PX_PER_INCH = 96;

export function canvasToInches(f: CanvasFormat): {
  w: number;
  h: number;
} {
  return { w: f.w / PX_PER_INCH, h: f.h / PX_PER_INCH };
}

/** 按 id 取格式；未知/缺省回落 16:9（历史 deck 兼容） */
export function getCanvasFormat(id?: string): CanvasFormat {
  return (
    CANVAS_FORMATS.find((f) => f.id === id) ??
    CANVAS_FORMATS.find((f) => f.id === DEFAULT_CANVAS_FORMAT_ID)!
  );
}
