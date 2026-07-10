import PptxGenJS from "pptxgenjs";
import type { Deck } from "@/types/deck";
import { resolveTheme } from "@/themes";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { getRendererMode } from "@/engine/renderer-config";
import { renderRenderSlideAsync } from "./render-slide";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export async function exportDeck(deck: Deck, path: string): Promise<void> {
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  // feature flag：当前仅 render-ir 一种模式（旧渲染器已迁移移除）
  const renderSlides = buildRenderSlides(deck, theme);
  for (const rs of renderSlides) {
    const s = pptx.addSlide();
    await renderRenderSlideAsync(s, rs);
  }
  const data = (await pptx.write({
    outputType: "uint8array",
  })) as Uint8Array;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_binary_file", {
    path,
    data: Array.from(data),
  });
}

export async function exportDeckToBlob(deck: Deck): Promise<Blob> {
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  // feature flag：当前仅 render-ir 一种模式（旧渲染器已迁移移除）
  void getRendererMode();
  const renderSlides = buildRenderSlides(deck, theme);
  for (const rs of renderSlides) {
    const s = pptx.addSlide();
    await renderRenderSlideAsync(s, rs);
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}

function initPptx(pptx: PptxGenJS) {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}
