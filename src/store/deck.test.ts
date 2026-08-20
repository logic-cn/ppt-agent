import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Deck } from "@/types/deck";
import { useDeckStore } from "./deck";

// mock executor，使其返回固定 svg，避免真实调用 LLM
vi.mock("@/engine/svg/executor", () => ({
  generateSlideSvg: vi.fn(async () => {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#fff"/><text x="10" y="40" font-size="32" fill="#111">重画的页面</text></svg>`;
  }),
  generateDeckSvgs: vi.fn(),
}));

import { generateSlideSvg } from "@/engine/svg/executor";

function makeDeck(): Deck {
  return {
    id: "test-deck",
    version: 2,
    title: "测试演示",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides: [
      {
        id: "s1",
        layout: "content",
        title: "第一页标题",
        // 故意不携带 svg，用于验证 regenerate 会写入
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("regenerateSlide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  });

  it("调用 executor 并将生成结果写回对应 slide.svg", async () => {
    const deck = makeDeck();
    useDeckStore.setState({ deck });

    await useDeckStore.getState().regenerateSlide("s1");

    // executor 应被调用一次
    expect(generateSlideSvg).toHaveBeenCalledTimes(1);

    const updated = useDeckStore.getState().deck!;
    expect(updated.slides[0].svg).toContain("重画的页面");
    expect(updated.slides[0].svg).toContain('viewBox="0 0 1280 720"');
  });

  it("找不到 slide 时不应抛错也不修改 deck", async () => {
    const deck = makeDeck();
    useDeckStore.setState({ deck });

    await expect(
      useDeckStore.getState().regenerateSlide("not-exist"),
    ).resolves.toBeUndefined();

    expect(generateSlideSvg).not.toHaveBeenCalled();
  });
});

describe("svgStale（编辑后 SVG 过期标记）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  });

  function deckWithSvg(): Deck {
    const deck = makeDeck();
    deck.slides[0].svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"></svg>';
    return deck;
  }

  it("编辑影响 SVG 视觉的结构化字段后置 svgStale=true", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    useDeckStore.getState().updateSlide("s1", { title: "新标题" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBe(true);
  });

  it("编辑 bullets 同样触发 svgStale", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    useDeckStore.getState().updateSlide("s1", {
      bullets: [{ id: "b1", text: "新要点", level: 0 }],
    });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBe(true);
  });

  it("编辑 notes（speaker notes，不参与 SVG 视觉）不触发 svgStale", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    useDeckStore.getState().updateSlide("s1", { notes: "演讲备注" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBeUndefined();
  });

  it("仅写回 svg 本身（如重画结果）不触发 svgStale", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    useDeckStore.getState().updateSlide("s1", { svg: "<svg></svg>" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBeUndefined();
  });

  it("无 svg 的页编辑结构化字段不产生 svgStale", () => {
    useDeckStore.setState({ deck: makeDeck() });
    useDeckStore.getState().updateSlide("s1", { title: "新标题" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBeUndefined();
  });

  it("regenerateSlide 成功后清除 svgStale", async () => {
    const deck = deckWithSvg();
    useDeckStore.setState({ deck });
    useDeckStore.getState().updateSlide("s1", { title: "改过的标题" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBe(true);

    await useDeckStore.getState().regenerateSlide("s1");
    const updated = useDeckStore.getState().deck!.slides[0];
    expect(updated.svg).toContain("重画的页面");
    expect(updated.svgStale).toBe(false);
  });

  it("setDesign 使所有带 svg 的页 svgStale=true", () => {
    const deck = deckWithSvg();
    deck.slides.push({
      id: "s2",
      layout: "closing",
      title: "结尾页",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"></svg>',
    });
    useDeckStore.setState({ deck });

    useDeckStore.getState().setDesign({
      mode: "briefing",
      visualStyle: "dark-tech",
      palette: "tech-purple",
    });

    const slides = useDeckStore.getState().deck!.slides;
    expect(slides[0].svgStale).toBe(true);
    expect(slides[1].svgStale).toBe(true);
  });

  it("setDesign 对无 svg 的页不产生 svgStale", () => {
    useDeckStore.setState({ deck: makeDeck() });
    useDeckStore.getState().setDesign({
      mode: "briefing",
      visualStyle: "dark-tech",
      palette: "tech-purple",
    });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBeUndefined();
  });
});

describe("undo/redo 与历史", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  });

  it("updateSlide 记录历史，undo 恢复旧值、redo 重放新值", () => {
    useDeckStore.setState({ deck: makeDeck() });
    useDeckStore.getState().updateSlide("s1", { title: "修改后标题" });

    expect(useDeckStore.getState().deck!.slides[0].title).toBe("修改后标题");
    expect(useDeckStore.getState().canUndo).toBe(true);
    expect(useDeckStore.getState().canRedo).toBe(false);

    useDeckStore.getState().undo();
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("第一页标题");
    expect(useDeckStore.getState().canRedo).toBe(true);

    useDeckStore.getState().redo();
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("修改后标题");
    expect(useDeckStore.getState().canRedo).toBe(false);
  });

  it("undo 栈无内容时无操作", () => {
    useDeckStore.setState({ deck: makeDeck(), past: [], canUndo: false });
    useDeckStore.getState().undo();
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("第一页标题");
  });

  it("新操作清空 future（redo 分支失效）", () => {
    useDeckStore.setState({ deck: makeDeck() });
    useDeckStore.getState().updateSlide("s1", { title: "A" });
    useDeckStore.getState().updateSlide("s1", { title: "B" });
    useDeckStore.getState().undo();
    useDeckStore.getState().undo();
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("第一页标题");

    // 在历史中间做新修改：future 被清空
    useDeckStore.getState().updateSlide("s1", { title: "C" });
    expect(useDeckStore.getState().canRedo).toBe(false);
    useDeckStore.getState().redo();
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("C");
  });

  it("历史超过 50 条时截断最旧记录", () => {
    useDeckStore.setState({ deck: makeDeck() });
    for (let i = 0; i < 55; i++) {
      useDeckStore.getState().updateSlide("s1", { title: `修改 ${i}` });
    }
    const past = useDeckStore.getState().past;
    expect(past.length).toBeLessThanOrEqual(50);
    // 最旧记录被丢弃：连续 undo 后应回到第 6 次修改而非初始状态
    for (let i = 0; i < 50; i++) {
      useDeckStore.getState().undo();
    }
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("修改 4");
  });
});
