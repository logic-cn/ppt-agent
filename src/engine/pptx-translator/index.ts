import PptxGenJS from "pptxgenjs";
import type { Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { translateSvgToSlide } from "./elements";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

function initPptx(pptx: PptxGenJS): void {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}

export async function svgToPptx(
  slides: Slide[],
  _design: DesignLock,
): Promise<Blob> {
  const pptx = new PptxGenJS();
  initPptx(pptx);

  for (const slide of slides) {
    if (!slide.svg) continue;
    const pptxSlide = pptx.addSlide();
    translateSvgToSlide(slide.svg, pptxSlide);
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}
