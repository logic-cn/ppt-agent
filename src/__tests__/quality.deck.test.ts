import { describe, it, expect } from "vitest";
import {
  checkDeckQuality,
  generateAutoFixes,
  qualityScore,
} from "@/services/quality/deck-quality";
import type { Deck } from "@/types/deck";

function createMockDeck(overrides?: Partial<Deck>): Deck {
  return {
    id: "test-deck",
    version: 1,
    title: "测试 Deck",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("checkDeckQuality", () => {
  it("完美 deck 无检查项", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面", notes: "开场讲稿" },
        {
          id: "s2",
          layout: "content",
          title: "市场分析",
          bullets: [{ id: "b1", text: "要点1", level: 0 }],
          notes: "正文讲稿",
        },
        { id: "s3", layout: "closing", title: "感谢聆听", notes: "收尾讲稿" },
      ],
    });
    const findings = checkDeckQuality(deck);
    expect(findings).toHaveLength(0);
    expect(qualityScore(findings)).toBe(100);
  });

  it("缺少封面页 → hard", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "第一页" }],
    });
    const findings = checkDeckQuality(deck);
    expect(findings.some((f) => f.rule === "require_cover")).toBe(true);
    expect(findings.find((f) => f.rule === "require_cover")!.severity).toBe(
      "hard",
    );
    expect(qualityScore(findings)).toBeLessThan(100);
  });

  it("缺少结尾页 → hard", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "内容" },
      ],
    });
    const findings = checkDeckQuality(deck);
    expect(findings.some((f) => f.rule === "require_closing")).toBe(true);
  });

  it("重复标题 → soft", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "市场分析" },
        { id: "s3", layout: "content", title: "市场分析" },
        { id: "s4", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    const dupIssues = findings.filter((f) => f.rule === "duplicate_title");
    expect(dupIssues).toHaveLength(2);
    expect(dupIssues[0].severity).toBe("soft");
  });

  it("过多 bullets → soft 且 autoFixable", () => {
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
    const findings = checkDeckQuality(deck);
    const f = findings.find((f) => f.rule === "bullets_too_many");
    expect(f).toBeDefined();
    expect(f!.severity).toBe("soft");
    expect(f!.autoFixable).toBe(true);
  });

  it("空图表 → hard", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "chart", title: "数据图表" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    expect(findings.some((f) => f.rule === "empty_chart")).toBe(true);
  });

  it("布局与内容不匹配 → soft", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "image", title: "配图页" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    expect(findings.some((f) => f.rule === "layout_content_mismatch")).toBe(
      true,
    );
  });

  it("空泛标题 → soft", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "概述" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    expect(findings.some((f) => f.rule === "vague_title")).toBe(true);
  });

  it("页数偏差超过 2 页 → soft", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "内容" },
      ],
    });
    const findings = checkDeckQuality(deck, { pageCount: 6 });
    expect(findings.some((f) => f.rule === "page_count_mismatch")).toBe(true);
  });

  it("评分计算正确", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "概述", notes: "讲稿" }],
    });
    const findings = checkDeckQuality(deck);
    // hard: require_cover, require_closing (2)；soft: vague_title (1)
    // （notes 补齐避免 notes_missing 计入）score = 100 - 2*15 - 1*6 = 64
    expect(qualityScore(findings)).toBe(64);
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
  it("require_charts：无图表页时给 hard", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "内容" },
        { id: "s3", layout: "closing", title: "结尾" },
      ],
    });
    const findings = checkDeckQuality(deck, { rules: ["require_charts"] });
    expect(findings.some((f) => f.rule === "chart_required")).toBe(true);
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
    const findings = checkDeckQuality(deck, { rules: ["require_charts"] });
    expect(findings.some((f) => f.rule === "chart_required")).toBe(false);
  });

  it("require_data：图表无数据时给 hard", () => {
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
    const findings = checkDeckQuality(deck, { rules: ["require_data"] });
    expect(findings.some((f) => f.rule === "empty_chart")).toBe(true);
  });

  it("不传 rules 时默认检查不含 chart_required", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "封面" }],
    });
    const findings = checkDeckQuality(deck);
    expect(findings.some((f) => f.rule === "chart_required")).toBe(false);
  });
});
