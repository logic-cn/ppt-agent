import { describe, it, expect } from "vitest";
import {
  checkDeckQuality,
  generateAutoFixes,
} from "@/services/quality/deck-quality";
import type { Deck } from "@/types/deck";

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

describe("checkDeckQuality", () => {
  it("完美 deck 得 100 分", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        {
          id: "s2",
          layout: "content",
          title: "市场分析",
          bullets: [{ id: "b1", text: "要点1", level: 0 }],
        },
        { id: "s3", layout: "closing", title: "感谢聆听" },
      ],
    });
    const report = checkDeckQuality(deck);
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it("缺少封面页报 error", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "第一页" }],
    });
    const report = checkDeckQuality(deck);
    expect(report.issues.some((i) => i.code === "missing_cover")).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it("缺少结尾页报 warning", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "内容" },
      ],
    });
    const report = checkDeckQuality(deck);
    expect(report.issues.some((i) => i.code === "missing_closing")).toBe(true);
  });

  it("重复标题报 warning", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "市场分析" },
        { id: "s3", layout: "content", title: "市场分析" },
        { id: "s4", layout: "closing", title: "总结" },
      ],
    });
    const report = checkDeckQuality(deck);
    const dupIssues = report.issues.filter((i) => i.code === "duplicate_title");
    expect(dupIssues).toHaveLength(2);
  });

  it("过多 bullets 报 warning", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        {
          id: "s2",
          layout: "content",
          title: "要点过多",
          bullets: Array.from({ length: 10 }, (_, i) => ({
            id: `b${i}`,
            text: `要点 ${i + 1}`,
            level: 0 as const,
          })),
        },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const report = checkDeckQuality(deck);
    expect(report.issues.some((i) => i.code === "too_many_bullets")).toBe(true);
  });

  it("空图表报 error", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "chart", title: "数据图表" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const report = checkDeckQuality(deck);
    expect(report.issues.some((i) => i.code === "empty_chart")).toBe(true);
  });

  it("布局与内容不匹配报 warning", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "image", title: "配图页" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const report = checkDeckQuality(deck);
    expect(
      report.issues.some((i) => i.code === "layout_content_mismatch"),
    ).toBe(true);
  });

  it("空泛标题报 info", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "概述" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const report = checkDeckQuality(deck);
    expect(report.issues.some((i) => i.code === "title_too_generic")).toBe(
      true,
    );
  });

  it("页数偏差超过 2 页报 info", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "内容" },
      ],
    });
    const report = checkDeckQuality(deck, { pageCount: 6 });
    expect(report.issues.some((i) => i.code === "page_count_mismatch")).toBe(
      true,
    );
  });

  it("评分计算正确", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "概述" }],
    });
    const report = checkDeckQuality(deck);
    // error: missing_cover (1), warning: missing_closing (1), info: title_too_generic (1)
    // score = 100 - 15 - 6 - 2 = 77
    expect(report.score).toBe(77);
  });
});

describe("generateAutoFixes", () => {
  it("为空标题生成占位", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "" }],
    });
    const fixes = generateAutoFixes(deck);
    expect(fixes.some((f) => f.type === "set_title")).toBe(true);
  });

  it("为无数据图表页生成改布局建议", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "chart", title: "图表" },
      ],
    });
    const fixes = generateAutoFixes(deck);
    expect(fixes.some((f) => f.type === "change_layout")).toBe(true);
  });

  it("缺少结尾页时追加", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "封面" }],
    });
    const fixes = generateAutoFixes(deck);
    expect(fixes.some((f) => f.type === "append_closing")).toBe(true);
  });
});

describe("模板 qualityRules", () => {
  it("require_charts：无图表页时给 warning", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "内容" },
        { id: "s3", layout: "closing", title: "结尾" },
      ],
    });
    const report = checkDeckQuality(deck, { rules: ["require_charts"] });
    expect(report.issues.some((i) => i.code === "chart_required")).toBe(true);
  });

  it("require_charts：已有图表页时不报", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        {
          id: "s2",
          layout: "chart",
          title: "图表",
          chart: { type: "bar", data: [{ label: "A", value: 1 }] },
        },
      ],
    });
    const report = checkDeckQuality(deck, { rules: ["require_charts"] });
    expect(report.issues.some((i) => i.code === "chart_required")).toBe(false);
  });

  it("require_data：图表无数据时给 error", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        {
          id: "s2",
          layout: "chart",
          title: "空图表",
          chart: { type: "bar", data: [] },
        },
      ],
    });
    const report = checkDeckQuality(deck, { rules: ["require_data"] });
    expect(report.issues.some((i) => i.code === "empty_chart")).toBe(true);
  });

  it("不传 rules 时默认检查不含 chart_required", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "封面" }],
    });
    const report = checkDeckQuality(deck);
    expect(report.issues.some((i) => i.code === "chart_required")).toBe(false);
  });
});
