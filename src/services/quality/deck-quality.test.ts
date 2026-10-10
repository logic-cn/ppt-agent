import { describe, it, expect } from "vitest";
import {
  checkDeckQuality,
  hasHardError,
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

describe("checkDeckQuality 分级", () => {
  it("缺封面 → hard", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "第一页" }],
    });
    const findings = checkDeckQuality(deck);
    const cover = findings.find((f) => f.rule === "require_cover");
    expect(cover).toBeDefined();
    expect(cover!.severity).toBe("hard");
    expect(cover!.autoFixable).toBe(false);
    expect(hasHardError(findings)).toBe(true);
  });

  it("内容页 8 条要点 → soft 且 autoFixable", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        {
          id: "s2",
          layout: "content",
          title: "要点过多",
          bullets: Array.from({ length: 8 }, (_, i) => ({
            id: `b${i}`,
            text: `要点 ${i + 1}`,
            level: 0 as const,
          })),
        },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    const bullets = findings.find((f) => f.rule === "bullets_too_many");
    expect(bullets).toBeDefined();
    expect(bullets!.severity).toBe("soft");
    expect(bullets!.autoFixable).toBe(true);
  });

  it("chart 布局但无图表数据 → hard", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "chart", title: "数据图表" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    const empty = findings.find((f) => f.rule === "empty_chart");
    expect(empty).toBeDefined();
    expect(empty!.severity).toBe("hard");
  });

  it("标题为「概述」→ soft（空泛标题）", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "content", title: "概述" },
        { id: "s3", layout: "closing", title: "总结" },
      ],
    });
    const findings = checkDeckQuality(deck);
    const vague = findings.find((f) => f.rule === "vague_title");
    expect(vague).toBeDefined();
    expect(vague!.severity).toBe("soft");
  });
});

// ---- 图表事实校准（B4）----

const CHART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <g data-chart-type="bar" data-chart-data='[{"label":"Q1","value":970},{"label":"Q2","value":1180}]'>
  </g>
</svg>`;

describe("checkChartFacts 图表事实校准", () => {
  it("图表数值在来源中找得到时不告警", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "content", title: "季度收入", svg: CHART_SVG },
      ],
    });
    const findings = checkDeckQuality(deck, {
      sourceText: "Q1 收入 970 万元，Q2 达到 1,180 万元",
    });
    expect(
      findings.filter((f) => f.rule === "chart_data_unverified"),
    ).toHaveLength(0);
  });

  it("图表数值在来源中找不到时报 soft 项", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "content", title: "季度收入", svg: CHART_SVG },
      ],
    });
    const findings = checkDeckQuality(deck, {
      sourceText: "本季度收入平稳增长，无具体数字。",
    });
    const unverified = findings.filter(
      (f) => f.rule === "chart_data_unverified",
    );
    expect(unverified).toHaveLength(1);
    expect(unverified[0].severity).toBe("soft");
    expect(unverified[0].slideId).toBe("s1");
    expect(unverified[0].message).toContain("970");
  });

  it("未提供 sourceText 时跳过校验", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "content", title: "季度收入", svg: CHART_SVG },
      ],
    });
    const findings = checkDeckQuality(deck);
    expect(
      findings.filter((f) => f.rule === "chart_data_unverified"),
    ).toHaveLength(0);
  });

  it("无 svg 的页面跳过校验", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "content", title: "纯文本页" }],
    });
    const findings = checkDeckQuality(deck, { sourceText: "没有任何数字" });
    expect(
      findings.filter((f) => f.rule === "chart_data_unverified"),
    ).toHaveLength(0);
  });
});

describe("SVG 层校验纳入质量检查（导出锁）", () => {
  const BAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#F1F5F9"/><text x="100" y="200" font-size="20" fill="#D1D5DB">浅灰说明</text></svg>`;

  it("含阻断级 SVG 问题的 deck → svg_* hard finding，触发导出锁", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面", svg: BAD_SVG },
        { id: "s2", layout: "closing", title: "谢谢" },
      ],
    });
    const findings = checkDeckQuality(deck);
    const bad = findings.find(
      (f) => f.rule === "svg_aesthetics" && f.severity === "hard",
    );
    expect(bad).toBeDefined();
    expect(bad!.message).toContain("对比度不足");
    expect(bad!.slideId).toBe("s1");
    expect(hasHardError(findings)).toBe(true);
  });

  it("brand 级对比度塌陷跨页去重：同一 token 组合只报一条", () => {
    // business-blue：textMuted #94A3B8 压在 text #F1F5F9 上（两端都是 token）
    const brandSvg = (t: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#0C1929"/><rect x="50" y="50" width="400" height="120" fill="#F1F5F9"/><text x="100" y="120" font-size="20" fill="#94A3B8">${t}</text></svg>`;
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面", svg: brandSvg("页一") },
        { id: "s2", layout: "content", title: "正文", svg: brandSvg("页二") },
        { id: "s3", layout: "closing", title: "谢谢", svg: brandSvg("页三") },
      ],
    });
    const brand = checkDeckQuality(deck).filter((f) => f.rule === "svg_brand");
    expect(brand).toHaveLength(1);
    expect(brand[0].severity).toBe("hard");
  });

  it("skipSvgChecks 跳过 SVG 层校验（首屏门/纯大纲态）", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "封面", svg: BAD_SVG }],
    });
    const findings = checkDeckQuality(deck, { skipSvgChecks: true });
    expect(
      findings.filter((f) => f.rule.startsWith("svg_")),
    ).toHaveLength(0);
  });

  it("无 svg 的纯大纲 deck 不产生 svg_* finding", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        { id: "s2", layout: "closing", title: "谢谢" },
      ],
    });
    expect(
      checkDeckQuality(deck).filter((f) => f.rule.startsWith("svg_")),
    ).toHaveLength(0);
  });

  it("warn 级美学问题映射为 soft finding（提示不阻断）", () => {
    const warnSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#0C1929"/><text x="100" y="120" font-size="40" fill="#F1F5F9">标题</text><text x="100" y="200" font-size="24" fill="#F1F5F9">要点一</text><rect x="200" y="300" width="200" height="80" fill="#1A2D42" flood-opacity="0.6"/></svg>`;
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "封面", svg: warnSvg },
        { id: "s2", layout: "closing", title: "谢谢" },
      ],
    });
    const findings = checkDeckQuality(deck);
    const soft = findings.filter(
      (f) => f.rule === "svg_aesthetics" && f.severity === "soft",
    );
    expect(soft.some((f) => /阴影浓度/.test(f.message))).toBe(true);
    expect(
      findings.filter((f) => f.rule.startsWith("svg_") && f.severity === "hard"),
    ).toHaveLength(0);
  });
});
