import PptxGenJS from "pptxgenjs";
import type { Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock } from "@/design/spec-lock";
import { translateSvgToSlide } from "./elements";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

function initPptx(pptx: PptxGenJS): void {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}

export async function svgToPptx(
  slides: Slide[],
  design: DesignLock,
): Promise<Blob> {
  // 由 design 构建 specLock 设计契约，注入图表配色等（无 design 时退化为默认调色板）。
  const specLock = design ? buildSpecLock(design) : undefined;

  const pptx = new PptxGenJS();
  initPptx(pptx);

  for (const slide of slides) {
    if (!slide.svg) continue;
    const pptxSlide = pptx.addSlide();
    translateSvgToSlide(slide.svg, pptxSlide, specLock);
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}
