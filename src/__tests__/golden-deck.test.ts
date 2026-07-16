import { describe, it, expect } from "vitest";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { validateRenderSlides } from "@/engine/render-ir/validate";
import { resolveTheme } from "@/themes";
import type { Deck } from "@/types/deck";
import simpleReview from "@/__fixtures__/decks/simple-business-review.json";
import chartHeavy from "@/__fixtures__/decks/chart-heavy.json";

function asDeck(raw: unknown): Deck {
  return raw as Deck;
}

describe("golden deck: simple-business-review", () => {
  const deck = asDeck(simpleReview);
  const theme = resolveTheme(deck.design.palette, deck.design.visualStyle);

  it("有 5 页幻灯片", () => {
    expect(deck.slides).toHaveLength(5);
  });

  it("RenderIR 节点数稳定", () => {
    const slides = buildRenderSlides(deck, theme);
    expect(slides).toHaveLength(5);
    // cover: top-bar(1) + title(1) + subtitle(1) = 3
    expect(slides[0].nodes).toHaveLength(3);
    // content: side-bar(1) + title(1) + bullets(1) = 3
    expect(slides[1].nodes).toHaveLength(3);
    // chart: side-bar(1) + title(1) + chart(1) = 3
    expect(slides[2].nodes).toHaveLength(3);
    // two-column with items: side-bar(1) + title(1) + 2 列(每列标题+要点)
    // soft-rounded 风格 separator:none，故每列无分隔线节点
    expect(slides[3].nodes).toHaveLength(6);
    expect(slides[3].nodes[2]).toMatchObject({
      type: "text",
      text: expect.stringContaining("亮点"),
    });
    // closing: top-bar(1) + title(1) + subtitle(1) = 3
    expect(slides[4].nodes).toHaveLength(3);
  });

  it("RenderIR 标题内容正确", () => {
    const slides = buildRenderSlides(deck, theme);
    expect(slides[0].nodes[1]).toMatchObject({
      type: "text",
      text: "Q2 业务复盘",
    });
    expect(slides[1].nodes[2]).toMatchObject({
      type: "text",
      text: expect.stringContaining("营收 ¥1,280 万"),
    });
    expect(slides[2].nodes[2]).toMatchObject({
      type: "chart",
    });
  });

  it("validate 无警告", () => {
    const slides = buildRenderSlides(deck, theme);
    const warnings = validateRenderSlides(slides);
    expect(warnings).toHaveLength(0);
  });

  it("PPTX 导出不抛错", async () => {
    const { exportDeckToBlob } = await import("@/engine/pptx");
    const blob = await exportDeckToBlob(deck);
    expect(blob.size).toBeGreaterThan(1000);
  });
});

describe("golden deck: chart-heavy", () => {
  const deck = asDeck(chartHeavy);
  const theme = resolveTheme(deck.design.palette, deck.design.visualStyle);

  it("有 5 页幻灯片", () => {
    expect(deck.slides).toHaveLength(5);
  });

  it("RenderIR 节点数稳定", () => {
    const slides = buildRenderSlides(deck, theme);
    expect(slides).toHaveLength(5);
    // cover: top-bar(1) + title(1) + subtitle(1) = 3
    expect(slides[0].nodes).toHaveLength(3);
    // 3 chart pages: each = side-bar + title + chart = 3
    for (let i = 1; i <= 3; i++) {
      expect(slides[i].nodes).toHaveLength(3);
      expect(slides[i].nodes[2]).toMatchObject({ type: "chart" });
    }
    // closing: top-bar(1) + title(1) = 2
    expect(slides[4].nodes).toHaveLength(2);
  });

  it("图表类型正确", () => {
    const slides = buildRenderSlides(deck, theme);
    const charts = slides.slice(1, 4).map((s) => s.nodes[2]);
    expect(charts[0]).toMatchObject({ type: "chart", chart: { type: "pie" } });
    expect(charts[1]).toMatchObject({ type: "chart", chart: { type: "line" } });
    expect(charts[2]).toMatchObject({
      type: "chart",
      chart: { type: "doughnut" },
    });
  });

  it("validate 无警告", () => {
    const slides = buildRenderSlides(deck, theme);
    const warnings = validateRenderSlides(slides);
    expect(warnings).toHaveLength(0);
  });

  it("PPTX 导出不抛错", async () => {
    const { exportDeckToBlob } = await import("@/engine/pptx");
    const blob = await exportDeckToBlob(deck);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
