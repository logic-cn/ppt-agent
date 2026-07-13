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
