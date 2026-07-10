import { describe, it, expect } from "vitest";
import { parseStoredDeck } from "@/services/storage/deck-parse";

function makeV1Deck() {
  return JSON.stringify({
    id: "test-1",
    version: 1,
    title: "V1 测试",
    themeId: "business-blue",
    slides: [
      { id: "", layout: "cover", title: "封面" },
      {
        layout: "content",
        title: "内容页",
        bullets: [
          { id: "", text: "旧要点", level: 0, children: [{ id: "", text: "子要点", level: 1 }] },
        ],
        items: [{ title: "项", bullets: ["b1"] }],
      },
      { layout: "unknown", title: "坏布局" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

describe("parseStoredDeck", () => {
  it("解析有效 v2 deck", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      themeId: "business-blue",
      slides: [{ id: "s1", layout: "cover", title: "封面" }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = parseStoredDeck(JSON.stringify(deck));
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("v1 deck 迁移到 v2", () => {
    const raw = makeV1Deck();
    const result = parseStoredDeck(raw);
    expect(result.success).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.data?.version).toBe(2);
  });

  it("迁移中补缺失的 id", () => {
    const raw = makeV1Deck();
    const result = parseStoredDeck(raw);
    expect(result.success).toBe(true);
    for (const slide of result.data?.slides ?? []) {
      expect(slide.id).toBeTruthy();
      expect(slide.id).not.toBe("");
      for (const bullet of slide.bullets ?? []) {
        expect(bullet.id).toBeTruthy();
        expect(bullet.id).not.toBe("");
        for (const child of bullet.children ?? []) {
          expect(child.id).toBeTruthy();
        }
      }
    }
  });

  it("修复中回退无效 layout", () => {
    const raw = makeV1Deck();
    const result = parseStoredDeck(raw);
    const slides = result.data?.slides ?? [];
    const badLayoutSlide = slides.find((s) => s.title === "坏布局");
    expect(badLayoutSlide?.layout).toBe("content");
  });

  it("未知未来版本拒绝解析", () => {
    const deck = {
      id: "future",
      version: 99,
      title: "未来版",
      themeId: "business-blue",
      slides: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = parseStoredDeck(JSON.stringify(deck));
    expect(result.success).toBe(false);
    expect(result.futureVersion).toBe(true);
  });

  it("非法 JSON 返回错误", () => {
    const result = parseStoredDeck("not json");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
