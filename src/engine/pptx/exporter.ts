import PptxGenJS from "pptxgenjs";
import type { Deck } from "@/types/deck";
import { resolveTheme } from "@/themes";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { getRendererMode } from "@/engine/renderer-config";
import { renderRenderSlideAsync } from "./render-slide";
import { svgToPptx } from "@/engine/pptx-translator";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// 判断 deck 是否走 X1 新链路：只要任一 slide 含 svg 字段即整 deck 走 svg 翻译器
function hasSvgSlides(deck: Deck): boolean {
  return deck.slides.some((s) => typeof s.svg === "string" && s.svg.length > 0);
}

export async function exportDeck(
  deck: Deck,
  path: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");

  // 新链路：存在 svg 的 deck 整 deck 走 svgToPptx，拿到 Blob 后转二进制写文件
  if (hasSvgSlides(deck)) {
    const blob = await svgToPptx(deck.slides, deck.design);
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    const data = new Uint8Array(await blob.arrayBuffer());
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_binary_file", {
      path,
      data: Array.from(data),
    });
    return;
  }

  // 旧链路 fallback：无 svg 的 deck 走 render-ir + renderRenderSlideAsync
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.design.palette, deck.design.visualStyle);
  const renderSlides = buildRenderSlides(deck, theme);
  for (const rs of renderSlides) {
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    const s = pptx.addSlide();
    await renderRenderSlideAsync(s, rs);
  }
  const data = (await pptx.write({
    outputType: "uint8array",
  })) as Uint8Array;
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_binary_file", {
    path,
    data: Array.from(data),
  });
}

export async function exportDeckToBlob(
  deck: Deck,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");

  // 新链路：存在 svg 的 deck 整 deck 走 svgToPptx，直接返回 Blob
  if (hasSvgSlides(deck)) {
    return svgToPptx(deck.slides, deck.design);
  }

  // 旧链路 fallback：无 svg 的 deck 走 render-ir + renderRenderSlideAsync
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.design.palette, deck.design.visualStyle);
  void getRendererMode();
  const renderSlides = buildRenderSlides(deck, theme);
  for (const rs of renderSlides) {
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    const s = pptx.addSlide();
    await renderRenderSlideAsync(s, rs);
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}

function initPptx(pptx: PptxGenJS) {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}
