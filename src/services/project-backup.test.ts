import { describe, expect, it } from "vitest";
import type { Deck } from "@/types/deck";
import { DEFAULT_DESIGN } from "@/types/design";
import { prepareImportedDeck, serializeDeckJson } from "./project-backup";

function makeDeck(): Deck {
  return {
    id: "old-id",
    version: 2,
    title: "旧项目",
    design: DEFAULT_DESIGN,
    slides: [
      { id: "s1", layout: "cover", title: "封面" },
      { id: "s2", layout: "content", title: "正文" },
    ],
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("project-backup", () => {
  it("序列化为可读 JSON", () => {
    const raw = serializeDeckJson(makeDeck());
    expect(raw).toContain('"title": "旧项目"');
    expect(raw.split("\n").length).toBeGreaterThan(5);
  });

  it("导入时分配新 id、加后缀并刷新时间", () => {
    const result = prepareImportedDeck(
      serializeDeckJson(makeDeck()),
      "（导入）",
      123456,
    );
    expect(result.deck.id).not.toBe("old-id");
    expect(result.deck.title).toBe("旧项目（导入）");
    expect(result.deck.createdAt).toBe(123456);
    expect(result.deck.updatedAt).toBe(123456);
    expect(result.deck.slides).toHaveLength(2);
  });

  it("非法 JSON 抛出可读错误", () => {
    expect(() => prepareImportedDeck("{not-json")).toThrow("JSON 解析失败");
  });

  it("拒绝未来版本", () => {
    const deck = { ...makeDeck(), version: 999 };
    expect(() => prepareImportedDeck(JSON.stringify(deck))).toThrow(
      /未知的 Deck 版本/,
    );
  });
});
