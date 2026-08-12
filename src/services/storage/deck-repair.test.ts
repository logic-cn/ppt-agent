import { describe, it, expect } from "vitest";
import { repairDeck } from "./deck-repair";
import type { Deck, Slide } from "@/types/deck";

describe("deck-repair palette 兜底", () => {
  it("custom-* 配色予以保留（交由 resolveTheme 解析/兜底）", () => {
    const deck = {
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "custom-ghost",
      },
    } as unknown as Deck;
    const fixed = repairDeck(deck);
    expect(fixed.deck.design.palette).toBe("custom-ghost");
  });

  it("非 custom 的无效 palette 回退默认", () => {
    const deck = {
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "ghost-blue",
      },
    } as unknown as Deck;
    const fixed = repairDeck(deck);
    expect(fixed.deck.design.palette).toBe("business-blue");
  });
});

describe("deck-repair 语义化布局数据保留（回归：白名单缺失导致数据丢失）", () => {
  it("metrics 布局保留 layout + metric 字段", () => {
    const slide = {
      id: "m1",
      layout: "metrics",
      title: "营收突破",
      metric: {
        value: "970",
        unit: "亿美元",
        label: "年度营收",
        kicker: "同比 +24%",
      },
    } as unknown as Slide;
    const fixed = repairDeck({
      id: "d1",
      version: 2,
      title: "t",
      design: {
        mode: "pyramid",
        visualStyle: "swiss-minimal",
        palette: "business-blue",
      },
      slides: [slide],
    } as unknown as Deck);
    const s = fixed.deck.slides[0];
    expect(s.layout).toBe("metrics");
    expect(s.metric).toEqual({
      value: "970",
      unit: "亿美元",
      label: "年度营收",
      kicker: "同比 +24%",
    });
  });

  it("quote 布局保留 layout + quote + attribution", () => {
    const slide = {
      id: "q1",
      layout: "quote",
      title: "核心论点",
      quote: "数据不是答案，模型才是",
      attribution: "某分析师",
    } as unknown;
    const fixed = repairDeck({
      id: "d1",
      version: 2,
      title: "t",
      design: {
        mode: "pyramid",
        visualStyle: "swiss-minimal",
        palette: "business-blue",
      },
      slides: [slide],
    } as unknown as Deck);
    const s = fixed.deck.slides[0];
    expect(s.layout).toBe("quote");
    expect(s.quote).toBe("数据不是答案，模型才是");
    expect(s.attribution).toBe("某分析师");
  });

  it("timeline 布局保留 layout（不回退 content）", () => {
    const slide = {
      id: "t1",
      layout: "timeline",
      title: "发展历程",
    } as unknown;
    const fixed = repairDeck({
      id: "d1",
      version: 2,
      title: "t",
      design: {
        mode: "pyramid",
        visualStyle: "swiss-minimal",
        palette: "business-blue",
      },
      slides: [slide],
    } as unknown as Deck);
    expect(fixed.deck.slides[0].layout).toBe("timeline");
  });
});
