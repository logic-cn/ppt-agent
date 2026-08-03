import PptxGenJS from "pptxgenjs";
import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock } from "@/design/spec-lock";
import { resolveTheme } from "@/themes";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { renderRenderSlideAsync } from "@/engine/pptx/render-slide";
import { translateSvgToSlide } from "./elements";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

function initPptx(pptx: PptxGenJS): void {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}

/**
 * 把 slides 导出为 pptx Blob。
 * - 有 svg 的页走 SVG → PPTX 原生翻译；
 * - 无 svg 的页回退 render-ir 旧链路渲染，保证混合 deck 不丢页。
 */
export async function svgToPptx(
  slides: Slide[],
  design: DesignLock,
  signal?: AbortSignal,
): Promise<Blob> {
  // 由 design 构建 specLock 设计契约，注入图表配色等
  const specLock = buildSpecLock(design);

  const pptx = new PptxGenJS();
  initPptx(pptx);

  // 仅当存在无 svg 页时才构建 render-ir 回退数据
  const needsFallback = slides.some((s) => !s.svg);
  const fallbackDeck: Deck = {
    id: "export",
    version: 2,
    title: "",
    design,
    slides,
    createdAt: 0,
    updatedAt: 0,
  };
  const renderSlides = needsFallback
    ? buildRenderSlides(
        fallbackDeck,
        resolveTheme(design.palette, design.visualStyle),
      )
    : null;

  for (let i = 0; i < slides.length; i++) {
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    const slide = slides[i];
    const pptxSlide = pptx.addSlide();
    if (slide.svg) {
      translateSvgToSlide(slide.svg, pptxSlide, specLock, slide.notes);
    } else if (renderSlides) {
      await renderRenderSlideAsync(pptxSlide, renderSlides[i]);
    }
  }

  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  // pptx.write 是大 deck 最耗时环节，写前再确认一次取消状态
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
