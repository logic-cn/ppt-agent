import type { RenderSlide, Rect } from "./types";

export interface RenderWarning {
  code:
    | "missing_layout"
    | "node_out_of_bounds"
    | "missing_image_url"
    | "text_overflow_clip"
    | "empty_nodes";
  slideId: string;
  message: string;
}

export function validateRenderSlides(slides: RenderSlide[]): RenderWarning[] {
  const warnings: RenderWarning[] = [];

  for (const slide of slides) {
    if (slide.nodes.length === 0) {
      warnings.push({
        code: "empty_nodes",
        slideId: slide.id,
        message: `页面 ${slide.id} 没有渲染节点`,
      });
      continue;
    }

    for (const node of slide.nodes) {
      const isLine = node.type === "shape" && node.shape === "line";
      if (isOutOfBounds(node.rect, isLine)) {
        warnings.push({
          code: "node_out_of_bounds",
          slideId: slide.id,
          message: `节点 ${node.id} 超出页面边界 (${node.rect.x}, ${node.rect.y}, ${node.rect.w}, ${node.rect.h})`,
        });
      }

      if (node.type === "text" && node.overflow === "clip") {
        warnings.push({
          code: "text_overflow_clip",
          slideId: slide.id,
          message: `文本节点 ${node.id} 使用 clip 策略，内容可能被裁剪`,
        });
      }

      if (node.type === "image" && !node.src) {
        warnings.push({
          code: "missing_image_url",
          slideId: slide.id,
          message: `图片节点 ${node.id} 缺少图片 URL`,
        });
      }
    }
  }

  return warnings;
}

function isOutOfBounds(rect: Rect, isLine = false): boolean {
  const margin = 0.01;
  if (isLine) {
    // 线条（line）允许其中一个维度为 0
    return (
      rect.x < -margin ||
      rect.y < -margin ||
      rect.x > 1 + margin ||
      rect.y > 1 + margin ||
      (rect.w <= 0 && rect.h <= 0)
    );
  }
  return (
    rect.x < -margin ||
    rect.y < -margin ||
    rect.x + rect.w > 1 + margin ||
    rect.y + rect.h > 1 + margin ||
    rect.w <= 0 ||
    rect.h <= 0
  );
}
