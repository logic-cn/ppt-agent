import { describe, it, expect } from "vitest";
import { checkDeckQuality } from "@/services/quality/deck-quality";
import type { Deck } from "@/types/deck";
import longBullets from "@/__fixtures__/decks/long-bullets.json";

function asDeck(raw: unknown): Deck {
  return raw as Deck;
}

describe("fixture: long-bullets 质量检查", () => {
  const deck = asDeck(longBullets);

  it("滑动加载出 12 条要点的内容页", () => {
    const slide = deck.slides.find((s) => s.id === "s2");
    expect(slide?.bullets).toHaveLength(12);
  });

  it("单页一级要点超过 7 条触发 too_many_bullets 警告", () => {
    const report = checkDeckQuality(deck);
    const issue = report.issues.find((i) => i.code === "too_many_bullets");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warning");
    expect(issue?.slideId).toBe("s2");
  });

  it("其余基础规则不误报（封面/结尾/重复标题/空图表均正常）", () => {
    const report = checkDeckQuality(deck);
    const codes = report.issues.map((i) => i.code);
    expect(codes).not.toContain("missing_cover");
    expect(codes).not.toContain("missing_closing");
    expect(codes).not.toContain("duplicate_title");
    expect(codes).not.toContain("empty_chart");
  });
});
