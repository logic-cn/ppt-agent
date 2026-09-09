import type { Deck, TransitionStyle } from "@/types/deck";
import { svgToPptx } from "@/engine/pptx-translator";
import { applyEffects } from "./ooxml";

export interface ExportEffectsOptions {
  /** 转场样式（none/缺省 = 不注入） */
  transition?: TransitionStyle;
  /** 对象入场淡入动画 */
  entranceAnimation?: boolean;
}

export async function exportDeck(
  deck: Deck,
  path: string,
  signal?: AbortSignal,
  effects?: ExportEffectsOptions,
): Promise<void> {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  const blob = await exportDeckToBlob(deck, signal, effects);
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  const data = new Uint8Array(await blob.arrayBuffer());
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_binary_file", {
    path,
    data: Array.from(data),
  });
}

export async function exportDeckToBlob(
  deck: Deck,
  signal?: AbortSignal,
  effects?: ExportEffectsOptions,
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  // 统一走 svgToPptx：有 svg 的页原生翻译，无 svg 的页内部回退 render-ir，不丢页
  const blob = await svgToPptx(deck.slides, deck.design, signal);
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  // D1 放映效果：转场 / 入场动画（OOXML 后处理）
  return applyEffects(blob, {
    transition: effects?.transition,
    entranceAnimation: effects?.entranceAnimation,
  });
}
