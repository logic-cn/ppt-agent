import { describe, it, expect } from "vitest";
import { applyAutoFixes } from "@/services/quality/auto-fix";
import { checkDeckQuality } from "@/services/quality/deck-quality";
import type { Deck } from "@/types/deck";
import type { DeckQualityIssue } from "@/services/quality";

function createMockDeck(overrides?: Partial<Deck>): Deck {
  return {
    id: "test-deck",
    version: 1,
    title: "测试 Deck",
    themeId: "business-blue",
    slides: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("applyAutoFixes", () => {
  it("无问题时原样返回（不生成新对象）", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s3", layout: "closing", title: "谢谢" },
      ],
    });
    expect(applyAutoFixes(deck)).toBe(deck);
  });

  it("为空白标题页生成占位标题", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "" }],
    });
    const fixed = applyAutoFixes(deck);
    expect(fixed.slides[0].title).toBe("未命名页面");
    expect(fixed).not.toBe(deck);
  });

  it("删除空要点", () => {
    const deck = createMockDeck({
      slides: [
        {
          id: "s1",
          layout: "content",
          title: "内容",
          bullets: [
            { id: "b1", text: "有效", level: 0 },
            { id: "b2", text: "   ", level: 0 },
          ],
        },
      ],
    });
    const fixed = applyAutoFixes(deck);
    expect(fixed.slides[0].bullets).toHaveLength(1);
    expect(fixed.slides[0].bullets![0].text).toBe("有效");
  });

  it("把无数据图表页改为正文布局", () => {
    const deck = createMockDeck({
      slides: [
        {
          id: "s1",
          layout: "chart",
          title: "空图表",
          chart: { type: "bar", data: [] },
        },
      ],
    });
    const fixed = applyAutoFixes(deck);
    expect(fixed.slides[0].layout).toBe("content");
    expect(fixed.slides[0].chart).toBeUndefined();
  });

  it("末尾非结尾时追加结尾页（仅一次）", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "封面" }],
    });
    const fixed = applyAutoFixes(deck);
    const last = fixed.slides[fixed.slides.length - 1];
    expect(last.layout).toBe("closing");
    expect(fixed.slides.filter((s) => s.layout === "closing")).toHaveLength(1);
  });

  it("已存在结尾页时不再追加", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "closing", title: "谢谢" },
      ],
    });
    const fixed = applyAutoFixes(deck);
    expect(fixed.slides).toHaveLength(2);
  });

  it("整套修复后原问题（空图表/空标题/缺结尾）被消除", () => {
    const deck = createMockDeck({
      slides: [
        {
          id: "s1",
          layout: "chart",
          title: "空图表",
          chart: { type: "bar", data: [] },
        },
        { id: "s2", layout: "content", title: "" },
      ],
    });
    const fixed = applyAutoFixes(deck);
    const report = checkDeckQuality(fixed);
    const codes = report.issues.map((i: DeckQualityIssue) => i.code);
    expect(codes).not.toContain("empty_chart");
    expect(codes).not.toContain("missing_closing");
    // 封面缺失不在自动修复范围内，仍应保留
    expect(codes).toContain("missing_cover");
  });
});
