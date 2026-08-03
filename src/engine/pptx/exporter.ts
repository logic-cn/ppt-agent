import type { Deck } from "@/types/deck";
import { svgToPptx } from "@/engine/pptx-translator";

export async function exportDeck(
  deck: Deck,
  path: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");

  // 统一走 svgToPptx：有 svg 的页原生翻译，无 svg 的页内部回退 render-ir，不丢页
  const blob = await svgToPptx(deck.slides, deck.design, signal);
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
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException("已取消", "AbortError");
  return svgToPptx(deck.slides, deck.design, signal);
}
