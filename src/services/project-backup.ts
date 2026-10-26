import type { Deck } from "@/types/deck";
import { parseStoredDeck } from "@/services/storage/deck-parse";
import { saveDeck } from "@/services/storage";

export interface ImportedDeckResult {
  deck: Deck;
  warnings: string[];
  migrated: boolean;
}

export function serializeDeckJson(deck: Deck): string {
  return JSON.stringify(deck, null, 2);
}

/**
 * 把项目 JSON 解析为一份新的 deck：重新分配 id、更新时间并加导入后缀，
 * 避免覆盖同 id 的现有项目。结构迁移/修复逻辑复用 storage 的加载链路。
 */
export function prepareImportedDeck(
  raw: string,
  titleSuffix = "",
  now = Date.now(),
): ImportedDeckResult {
  const parsed = parseStoredDeck(raw);
  if (!parsed.success || !parsed.data) {
    throw new Error(parsed.error ?? "项目文件校验失败");
  }
  const deck = parsed.data as unknown as Deck;
  const title = `${deck.title || "未命名项目"}${titleSuffix}`;
  return {
    deck: {
      ...deck,
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
    },
    warnings: parsed.warnings ?? [],
    migrated: parsed.migrated ?? false,
  };
}

export async function importDeckJson(
  raw: string,
  titleSuffix = "",
): Promise<ImportedDeckResult> {
  const result = prepareImportedDeck(raw, titleSuffix);
  await saveDeck(result.deck);
  return result;
}
