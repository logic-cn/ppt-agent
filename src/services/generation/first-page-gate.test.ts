import { describe, it, expect } from "vitest";
import { runFirstPageGate } from "@/services/generation/first-page-gate";
import type { Deck } from "@/types/deck";
import type { DesignLock } from "@/types/design";

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

const PYRAMID_DESIGN: DesignLock = {
  mode: "pyramid",
  visualStyle: "soft-rounded",
  palette: "business-blue",
};

describe("runFirstPageGate 首屏风格锚点", () => {
  it("pyramid 模式下首屏标题为话题词 → 返回 pyramid_title hard finding", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "市场概述" },
        { id: "s2", layout: "content", title: "正文" },
      ],
    });
    const findings = runFirstPageGate(deck, PYRAMID_DESIGN);
    const finding = findings.find((f) => f.rule === "pyramid_title");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("hard");
    expect(finding!.autoFixable).toBe(false);
    expect(finding!.slideId).toBe("s1");
    expect(finding!.message).toContain("结论先行");
  });

  it("pyramid 模式下首屏标题为结论句 → 无 pyramid_title finding", () => {
    const deck = createMockDeck({
      slides: [
        { id: "s1", layout: "cover", title: "留存而非拉新驱动本季增长" },
        { id: "s2", layout: "content", title: "正文" },
      ],
    });
    const findings = runFirstPageGate(deck, PYRAMID_DESIGN);
    const finding = findings.find((f) => f.rule === "pyramid_title");
    expect(finding).toBeUndefined();
    // 首屏单页无法判定 deck 级规则，必须无残留误报（如 require_closing）
    expect(findings).toHaveLength(0);
  });

  it("无首屏 → 返回空数组", () => {
    const deck = createMockDeck({ slides: [] });
    expect(runFirstPageGate(deck, PYRAMID_DESIGN)).toEqual([]);
  });

  it("非 pyramid 模式首屏标题为话题词 → 不返回 pyramid_title", () => {
    const deck = createMockDeck({
      slides: [{ id: "s1", layout: "cover", title: "市场概述" }],
    });
    const findings = runFirstPageGate(deck, {
      ...PYRAMID_DESIGN,
      mode: "narrative",
    });
    expect(findings.find((f) => f.rule === "pyramid_title")).toBeUndefined();
  });
});
