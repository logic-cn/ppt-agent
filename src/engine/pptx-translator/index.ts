import PptxGenJS from "pptxgenjs";
import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock, type SpecLock } from "@/design/spec-lock";
import { canvasToInches, getCanvasFormat } from "@/types/canvas";
import { resolveTheme } from "@/themes";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { renderRenderSlideAsync } from "@/engine/pptx/render-slide";
import { applyNativeTheme } from "@/engine/pptx/theme";
import { translateSvgToSlide, ooxmlFontFace } from "./elements";

function initPptx(pptx: PptxGenJS, inches: { w: number; h: number }): void {
  pptx.defineLayout({ name: "CUSTOM", width: inches.w, height: inches.h });
  pptx.layout = "CUSTOM";
}

/**
 * 逐角色原生母版与版式（参照 PPT Master 的 p:sldMaster / p:sldLayout 输出）：
 * 每个语义角色一个 defineSlideMaster（导出为独立 p:sldLayout 部件），
 * PowerPoint「幻灯片母版」视图按角色呈现品牌结构：
 * - cover/closing：仅背景（首尾重氛围，无品牌条与页码）；
 * - section：背景 + 底部品牌条；
 * - content：背景 + 品牌条 + 页码字段（正文页承载版式）。
 * 幻灯片内容（全幅 SVG 背景矩形）会盖在母版对象之上——母版的价值在于
 * 原生主题结构，用户删除页面背景矩形后即可见。
 */
export const ROLE_MASTER_NAMES = {
  cover: "PPT_AGENT_COVER",
  section: "PPT_AGENT_SECTION",
  content: "PPT_AGENT_CONTENT",
  closing: "PPT_AGENT_CLOSING",
} as const;

/** slide 版式 → 角色母版名（非首尾/章节版式一律正文母版） */
export function roleMasterForLayout(layout: string | undefined): string {
  if (layout === "cover") return ROLE_MASTER_NAMES.cover;
  if (layout === "section") return ROLE_MASTER_NAMES.section;
  if (layout === "closing") return ROLE_MASTER_NAMES.closing;
  return ROLE_MASTER_NAMES.content;
}

export function defineDeckMasters(
  pptx: PptxGenJS,
  specLock: SpecLock,
  inches: { w: number; h: number },
): void {
  const background = {
    color: specLock.colors.background.replace("#", ""),
  };
  const brandBar = {
    rect: {
      x: 0,
      y: inches.h - 0.08,
      w: inches.w,
      h: 0.08,
      fill: { color: specLock.colors.accent.replace("#", "") },
    },
  };
  const slideNumber = {
    x: inches.w - 0.7,
    y: inches.h - 0.4,
    w: 0.5,
    h: 0.3,
    color: specLock.colors.textMuted.replace("#", ""),
    fontFace: ooxmlFontFace(specLock.fonts.body),
    fontSize: 10,
  };
  pptx.defineSlideMaster({ title: ROLE_MASTER_NAMES.cover, background });
  pptx.defineSlideMaster({
    title: ROLE_MASTER_NAMES.section,
    background,
    objects: [brandBar],
  });
  pptx.defineSlideMaster({
    title: ROLE_MASTER_NAMES.content,
    background,
    objects: [brandBar],
    slideNumber,
  });
  pptx.defineSlideMaster({
    title: ROLE_MASTER_NAMES.closing,
    background,
  });
}

/**
 * 把 slides 导出为 pptx Blob。
 * - 有 svg 的页走 SVG → PPTX 原生翻译；
 * - 无 svg 的页回退 render-ir 旧链路渲染，保证混合 deck 不丢页；
 * - 写出后把主题改为 SpecLock 的原生字体/配色（PowerPoint 主题面板可感知）。
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
  defineDeckMasters(pptx, specLock, inches);

  // 仅当存在无 svg 页时才构建 render-ir 回退数据；
  // 布局坐标为 0..1 相对值，按实际画布英寸缩放——非 16:9 也能导出而不是留空。
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
    const pptxSlide = pptx.addSlide({
      masterName: roleMasterForLayout(slide.layout),
    });
    if (slide.svg) {
      translateSvgToSlide(slide.svg, pptxSlide, specLock, slide.notes);
    } else if (renderSlides) {
      await renderRenderSlideAsync(pptxSlide, renderSlides[i], inches);
    }
  }

  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  // pptx.write 是大 deck 最耗时环节，写前再确认一次取消状态
  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return applyNativeTheme(blob, specLock);
}
