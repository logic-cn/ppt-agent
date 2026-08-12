import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Deck, Slide } from "@/types/deck";
import { DEFAULT_DESIGN, type DesignLock } from "@/types/design";
import { buildDeckSvgs, buildDeckSvgsDetailed } from "./pipeline";

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

  it("未传 topic 时从 deck.title 派生", async () => {
    const deck = makeDeck([makeSlide("a")]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockImplementation(async (args) => {
        expect(args.topic).toBe(deck.title);
        return [{ role: "content", title: "T", intent: "i" }];
      });
    const svgMock = vi
      .spyOn(await import("./executor"), "generateDeckSvgs")
      .mockResolvedValue([{ index: 0, role: "content", svg: SVG }]);

    await buildDeckSvgs(deck, DESIGN, {} as never);

    expect(planMock).toHaveBeenCalled();

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
      .mockImplementation(async (_plan, _spec, opts) => {
        opts?.onProgress?.(1, 1);
        return [{ index: 0, role: "content", svg: SVG }];
      });

    await buildDeckSvgs(deck, DESIGN, { topic: "t", onProgress });

    expect(onProgress).toHaveBeenCalledWith(1, 1);

    planMock.mockRestore();
    svgMock.mockRestore();
  });

  it("isolatePageFailures：单页失败不中断，保留旧 svg 并回传失败页", async () => {
    const deck = makeDeck([
      { ...makeSlide("a"), svg: "<svg>old-a</svg>" },
      { ...makeSlide("b"), svg: "<svg>old-b</svg>" },
    ]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([
        { role: "content", title: "T0", intent: "i0" },
        { role: "content", title: "T1", intent: "i1" },
      ]);
    const genMock = vi
      .spyOn(await import("./executor"), "generateSlideSvg")
      .mockImplementation(async (opts) => {
        if (opts.pageIndex === 0) throw new Error("token 耗尽");
        return `<svg viewBox="0 0 1280 720"><text>${opts.plan.title}</text></svg>`;
      });
    const onPageError = vi.fn();

    const result = await buildDeckSvgsDetailed(deck, DESIGN, {
      topic: "t",
      isolatePageFailures: true,
      onPageError,
    });

    // 第 0 页失败（保留旧 svg），第 1 页成功
    expect(result.failedPages).toEqual([0]);
    expect(onPageError).toHaveBeenCalledTimes(1);
    expect(onPageError).toHaveBeenCalledWith(0, expect.any(Error), true);
    expect(result.deck.slides[0].svg).toBe("<svg>old-a</svg>");
    expect(result.deck.slides[1].svg).toContain(">T1<");

    planMock.mockRestore();
    genMock.mockRestore();
  });

  it("isolatePageFailures：已有 slide 无旧 svg 时失败按未保留旧 svg 回传", async () => {
    const deck = makeDeck([makeSlide("a")]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([
        { role: "content", title: "T0", intent: "i0" },
        { role: "content", title: "T1", intent: "i1" },
      ]);
    const genMock = vi
      .spyOn(await import("./executor"), "generateSlideSvg")
      .mockImplementation(async () => {
        throw new Error("token 耗尽");
      });
    const onPageError = vi.fn();

    const result = await buildDeckSvgsDetailed(deck, DESIGN, {
      topic: "t",
      isolatePageFailures: true,
      onPageError,
    });

    expect(result.failedPages).toEqual([0, 1]);
    expect(onPageError).toHaveBeenCalledWith(0, expect.any(Error), false);

    planMock.mockRestore();
    genMock.mockRestore();
  });

  it("isolatePageFailures：空 deck 下失败页以无 svg 占位并回传", async () => {
    const deck = makeDeck([]);

    const planMock = vi
      .spyOn(await import("@/services/outline"), "generatePagePlan")
      .mockResolvedValue([
        { role: "content", title: "T0", intent: "i0" },
        { role: "content", title: "T1", intent: "i1" },
      ]);
    const generateMock = vi
      .spyOn(await import("./executor"), "generateSlideSvg")
      .mockImplementation(async (opts) => {
        if (opts.pageIndex === 1) throw new Error("越界");
        return `<svg viewBox="0 0 1280 720"><text>页${opts.pageIndex}</text></svg>`;
      });

    const result = await buildDeckSvgsDetailed(deck, DESIGN, {
      topic: "t",
      isolatePageFailures: true,
    });

    expect(result.failedPages).toEqual([1]);
    expect(result.deck.slides).toHaveLength(2);
    expect(result.deck.slides[0].svg).toBeDefined();
    // 失败页被初始化但无 svg，留待用户手动重画
    expect(result.deck.slides[1].svg).toBeUndefined();
    expect(result.deck.slides[1].layout).toBe("content");
    expect(result.deck.slides[1].title).toBe("T1");

    planMock.mockRestore();
    generateMock.mockRestore();
  });
});
