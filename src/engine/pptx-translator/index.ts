import PptxGenJS from "pptxgenjs";
import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock, type SpecLock } from "@/design/spec-lock";
import { canvasToInches, getCanvasFormat } from "@/types/canvas";
import { resolveTheme } from "@/themes";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { renderRenderSlideAsync } from "@/engine/pptx/render-slide";
import { translateSvgToSlide } from "./elements";

function initPptx(pptx: PptxGenJS, inches: { w: number; h: number }): void {
  pptx.defineLayout({ name: "CUSTOM", width: inches.w, height: inches.h });
  pptx.layout = "CUSTOM";
}

/**
 * 定义 deck 母版（参照 PPT Master 的 p:sldMaster 输出）：背景色 + 底部品牌条 + 页码字段。
 * 幻灯片内容（全幅 SVG 背景矩形）会盖在母版对象之上——母版的价值在于
 * PowerPoint「幻灯片母版」视图里呈现品牌结构，且页码/背景为真原生字段，
 * 用户删除页面背景矩形后即可见。
 */
export function defineDeckMaster(
  pptx: PptxGenJS,
  specLock: SpecLock,
  inches: { w: number; h: number },
): string {
  const masterName = "PPT_AGENT_MASTER";
  pptx.defineSlideMaster({
    title: masterName,
    background: { color: specLock.colors.background.replace("#", "") },
    objects: [
      {
        rect: {
          x: 0,
          y: inches.h - 0.08,
          w: inches.w,
          h: 0.08,
          fill: { color: specLock.colors.accent.replace("#", "") },
        },
      },
    ],
    slideNumber: {
      x: inches.w - 0.7,
      y: inches.h - 0.4,
      w: 0.5,
      h: 0.3,
      color: specLock.colors.textMuted.replace("#", ""),
      fontFace: specLock.fonts.body,
      fontSize: 10,
    },
  });
  return masterName;
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
  const canvas = getCanvasFormat(design.canvasFormat);
  const inches = canvasToInches(canvas);

  const pptx = new PptxGenJS();
  initPptx(pptx, inches);
  const masterName = defineDeckMaster(pptx, specLock, inches);

  // 仅当存在无 svg 页时才构建 render-ir 回退数据；
  // render-ir 主题布局按 1280×720 设计，非 16:9 画布不回退（无 svg 页留空，导出后可手补）
  const needsFallback = canvas.id === "ppt-16-9" && slides.some((s) => !s.svg);
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
    const pptxSlide = pptx.addSlide({ masterName });
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
