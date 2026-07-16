import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Deck, Slide } from "@/types/deck";
import { DEFAULT_DESIGN, type DesignLock } from "@/types/design";
import { buildDeckSvgs } from "./pipeline";

const DESIGN: DesignLock = DEFAULT_DESIGN;

function makeDeck(slides: Slide[]): Deck {
  return {
    id: "deck1",
    version: 2,
    title: "测试",
    design: DESIGN,
    slides,
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeSlide(id: string): Slide {
  return { id, layout: "content", title: `页 ${id}` };
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="100" height="50" fill="#111"/></svg>`;

describe("buildDeckSvgs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("按 plan 数量把 svg 写回对应 slide，且不修改入参", async () => {
    const deck = makeDeck([makeSlide("a"), makeSlide("b"), makeSlide("c")]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([
        { role: "cover", title: "T1", intent: "i1" },
        { role: "content", title: "T2", intent: "i2" },
        { role: "closing", title: "T3", intent: "i3" },
      ]);
    const svgMock = vi
      .spyOn(await import("./executor"), "generateDeckSvgs")
      .mockResolvedValue([
        {
          index: 0,
          role: "cover",
          svg: `<svg viewBox="0 0 1280 720">${1}</svg>`,
        },
        {
          index: 1,
          role: "content",
          svg: `<svg viewBox="0 0 1280 720">${2}</svg>`,
        },
        {
          index: 2,
          role: "closing",
          svg: `<svg viewBox="0 0 1280 720">${3}</svg>`,
        },
      ]);

    const result = await buildDeckSvgs(deck, DESIGN, { topic: "t" });

    expect(result.slides).toHaveLength(3);
    expect(result.slides[0].svg).toContain("0 0 1280 720");
    expect(result.slides[1].svg).toContain("0 0 1280 720");
    expect(result.slides[2].svg).toContain("0 0 1280 720");
    // 原 deck 未被修改
    expect(deck.slides[0].svg).toBeUndefined();
    expect(result).not.toBe(deck);
    expect(result.slides[0]).not.toBe(deck.slides[0]);

    planMock.mockRestore();
    svgMock.mockRestore();
  });

  it("deck 无 slides 时按 plan 新建带 svg 的 slide", async () => {
    const deck = makeDeck([]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([
        { role: "cover", title: "封面", intent: "i" },
        { role: "closing", title: "结尾", intent: "i" },
      ]);
    const svgMock = vi
      .spyOn(await import("./executor"), "generateDeckSvgs")
      .mockResolvedValue([
        { index: 0, role: "cover", svg: SVG },
        { index: 1, role: "closing", svg: SVG },
      ]);

    const result = await buildDeckSvgs(deck, DESIGN, { topic: "t" });

    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].title).toBe("封面");
    expect(result.slides[0].svg).toBe(SVG);
    expect(result.slides[1].layout).toBe("closing");

    planMock.mockRestore();
    svgMock.mockRestore();
  });

  it("deck slides 多于 plan 时保留多出的 slide（仅覆盖前 N 页）", async () => {
    const extra: Slide = { id: "x", layout: "content", title: "多余页" };
    const deck = makeDeck([makeSlide("a"), makeSlide("b"), extra]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([
        { role: "content", title: "T1", intent: "i" },
        { role: "content", title: "T2", intent: "i" },
      ]);
    const svgMock = vi
      .spyOn(await import("./executor"), "generateDeckSvgs")
      .mockResolvedValue([
        { index: 0, role: "content", svg: SVG },
        { index: 1, role: "content", svg: SVG },
      ]);

    const result = await buildDeckSvgs(deck, DESIGN, { topic: "t" });

    expect(result.slides).toHaveLength(3);
    expect(result.slides[2].id).toBe("x");
    expect(result.slides[2].svg).toBeUndefined();

    planMock.mockRestore();
    svgMock.mockRestore();
  });

  it("传递 onProgress 回调给 executor", async () => {
    const deck = makeDeck([makeSlide("a")]);
    const onProgress = vi.fn();

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([{ role: "content", title: "T", intent: "i" }]);
    const svgMock = vi
      .spyOn(await import("./executor"), "generateDeckSvgs")
      .mockImplementation(async (_plan, _spec, cb) => {
        cb?.(1, 1);
        return [{ index: 0, role: "content", svg: SVG }];
      });

    await buildDeckSvgs(deck, DESIGN, { topic: "t", onProgress });

    expect(onProgress).toHaveBeenCalledWith(1, 1);

    planMock.mockRestore();
    svgMock.mockRestore();
  });
});
