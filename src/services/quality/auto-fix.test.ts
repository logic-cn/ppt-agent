import { describe, it, expect } from "vitest";
import { applyAutoFixes, getHardFindings } from "@/services/quality/auto-fix";
import { checkDeckQuality } from "@/services/quality/deck-quality";
import type { Deck, Slide } from "@/types/deck";
import type { QualityFinding } from "@/services/quality";

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

function cover(): Slide {
  return { id: "cover", layout: "cover", title: "封面" };
}

function closing(): Slide {
  return { id: "closing", layout: "closing", title: "谢谢观看" };
}

function contentWithBullets(id: string, n: number): Slide {
  return {
    id,
    layout: "content",
    title: `内容 ${id}`,
    bullets: Array.from({ length: n }, (_, i) => ({
      id: `${id}-b${i}`,
      text: `要点 ${i}`,
      level: 0,
    })),
  };
}

describe("applyAutoFixes", () => {
  it("无 soft+autoFixable 问题时原样返回（不产生新对象）", () => {
    const deck = createMockDeck({
      slides: [cover(), closing()],
    });
    const findings = checkDeckQuality(deck);
    expect(applyAutoFixes(deck, findings)).toBe(deck);
  });

  it("仅对 soft+autoFixable 生效：硬问题页不被修改", () => {
    const deck = createMockDeck({
      slides: [
        // 缺封面（hard: require_cover）
        contentWithBullets("s1", 8),
        closing(),
      ],
    });
    const findings = checkDeckQuality(deck);
    const hard = getHardFindings(findings);
    const softFixable = findings.filter(
      (f) => f.severity === "soft" && f.autoFixable,
    );
    expect(hard.length).toBeGreaterThan(0);
    expect(softFixable.length).toBeGreaterThan(0);

    const fixed = applyAutoFixes(deck, findings);

    // 硬问题（缺封面）的页保持原样：首张仍是 content 布局、标题未变
    expect(fixed.slides[0].layout).toBe("content");
    expect(fixed.slides[0].title).toBe("内容 s1");
    // soft+autoFixable（8 条要点）被裁剪到 <=7
    expect(fixed.slides[0].bullets!.length).toBeLessThanOrEqual(7);
  });

  it("硬 finding 与 soft+autoFixable 同时存在时，两者正确分流", () => {
    const deck = createMockDeck({
      slides: [
        contentWithBullets("s1", 8),
        contentWithBullets("s2", 9),
        closing(),
      ],
    });
    // 手动构造一个 hard finding 指向 s2，确保硬问题不被触碰
    const findings: QualityFinding[] = [
      {
        rule: "require_cover",
        severity: "hard",
        slideId: "s2",
        message: "硬问题",
        autoFixable: false,
      },
      {
        rule: "bullets_too_many",
        severity: "soft",
        slideId: "s1",
        message: "要点过多",
        autoFixable: true,
      },
    ];

    const fixed = applyAutoFixes(deck, findings);

    // s1（soft+autoFixable）被裁剪
    expect(
      fixed.slides.find((s) => s.id === "s1")!.bullets!.length,
    ).toBeLessThanOrEqual(7);
    // s2（hard）未被修改
    expect(fixed.slides.find((s) => s.id === "s2")!.bullets!.length).toBe(9);
  });

  it("不修改输入 deck（纯函数）", () => {
    const deck = createMockDeck({
      slides: [contentWithBullets("s1", 8), closing()],
    });
    const before = JSON.stringify(deck);
    const findings = checkDeckQuality(deck);
    applyAutoFixes(deck, findings);
    expect(JSON.stringify(deck)).toBe(before);
  });

  it("getHardFindings 只返回 hard 级", () => {
    const deck = createMockDeck({
      slides: [contentWithBullets("s1", 8), closing()],
    });
    const findings = checkDeckQuality(deck);
    const hard = getHardFindings(findings);
    expect(hard.every((f) => f.severity === "hard")).toBe(true);
    expect(hard.length).toBeGreaterThan(0);
  });
});
