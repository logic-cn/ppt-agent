import { deckSchema, CURRENT_DECK_VERSION } from "./deck-schema";
import type { DeckParseResult } from "./deck-schema";
import { migrateToCurrentDeck } from "./deck-migrations";
import { repairDeck } from "./deck-repair";

export function parseStoredDeck(raw: string): DeckParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: "JSON 解析失败" };
  }

  const { data: migrated, migrated: didMigrate, futureVersion } =
    migrateToCurrentDeck(parsed);

  if (futureVersion) {
    return {
      success: false,
      error: `未知的 Deck 版本（高于当前版本 ${CURRENT_DECK_VERSION}），请升级应用后再打开`,
      futureVersion: true,
    };
  }

  const { deck: repaired, warnings } = repairDeck(migrated);

  const result = deckSchema.safeParse(repaired);
  if (!result.success) {
    return {
      success: false,
      error: `Deck 校验失败：${result.error.message}`,
      warnings,
    };
  }

  return {
    success: true,
    data: result.data,
    warnings,
    migrated: didMigrate,
  };
}
