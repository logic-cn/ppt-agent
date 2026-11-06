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
    useDeckStore.setState({
      deck: null,
      past: [],
      future: [],
      dirty: false,
      canUndo: false,
      canRedo: false,
    });
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

  it("切换 layout 触发 svgStale（布局是最强视觉字段）", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    useDeckStore.getState().updateSlide("s1", { layout: "chart" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBe(true);
  });

  it("视觉字段与显式 svgStale 组合 patch 时以显式值为准", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    useDeckStore.getState().updateSlide("s1", {
      title: "新标题",
      svgStale: false,
    });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBe(false);
  });

  it("svg 被清空时清除过期标记", () => {
    const deck = deckWithSvg();
    useDeckStore.setState({ deck });
    useDeckStore.getState().updateSlide("s1", { title: "改" });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBe(true);

    useDeckStore.getState().updateSlide("s1", { svg: undefined });
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBeUndefined();
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

  it("setDesign 传入与当前相同的 design 时不标记过期也不记历史", () => {
    useDeckStore.setState({ deck: deckWithSvg() });
    const design = useDeckStore.getState().deck!.design;
    useDeckStore.getState().setDesign(design);
    expect(useDeckStore.getState().deck!.slides[0].svgStale).toBeUndefined();
    expect(useDeckStore.getState().canUndo).toBe(false);
  });

  it("setDesign 仅变更 canvasFormat 时同样生效并标记 SVG 过期（回归：同值守卫曾吞掉该字段）", () => {
    const deck = deckWithSvg();
    useDeckStore.setState({ deck });
    const current = useDeckStore.getState().deck!.design;

    useDeckStore.getState().setDesign({ ...current, canvasFormat: "xhs-3-4" });
    const after = useDeckStore.getState().deck!;
    expect(after.design.canvasFormat).toBe("xhs-3-4");
    expect(after.slides[0].svgStale).toBe(true);
    expect(useDeckStore.getState().canUndo).toBe(true);
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
    // 用 55 个不同页各编辑一次：同页连续编辑会被历史合并（另测），
    // 不同页的 key 不同，产生 55 条独立历史以验证截断上限
    const many = makeDeck();
    many.slides = Array.from({ length: 55 }, (_, i) => ({
      id: `s${i}`,
      layout: "content" as const,
      title: `原始页 ${i}`,
    }));
    useDeckStore.setState({ deck: many });
    for (let i = 0; i < 55; i++) {
      useDeckStore.getState().updateSlide(`s${i}`, { title: `修改 ${i}` });
    }
    const past = useDeckStore.getState().past;
    expect(past.length).toBeLessThanOrEqual(50);
    // 最旧 5 条被丢弃：undo 到底应回到第 5 次修改后的状态而非初始状态
    for (let i = 0; i < 50; i++) {
      useDeckStore.getState().undo();
    }
    expect(useDeckStore.getState().deck!.slides[4].title).toBe("修改 4");
    expect(useDeckStore.getState().deck!.slides[5].title).toBe("原始页 5");
  });

  it("同一页的连续字段编辑在时间窗口内合并为一次撤销", () => {
    useDeckStore.setState({ deck: makeDeck() });
    // 模拟检查器 debounce 落盘：一句带停顿的话产生多次快速编辑
    useDeckStore.getState().updateSlide("s1", { title: "改" });
    useDeckStore.getState().updateSlide("s1", { title: "改一" });
    useDeckStore.getState().updateSlide("s1", { title: "改一半" });
    expect(useDeckStore.getState().past.length).toBe(1);
    // 一次撤销回到整段编辑开始前
    useDeckStore.getState().undo();
    expect(useDeckStore.getState().deck!.slides[0].title).toBe("第一页标题");
  });
});

describe("updateSlideSvgLive（D2 流式预览）", () => {
  it("静默更新单页 SVG 且不产生历史条目", () => {
    const slide = { id: "s1", layout: "content" as const, title: "标题" };
    useDeckStore.setState({
      deck: {
        id: "d",
        version: 2,
        title: "t",
        design: {
          mode: "briefing",
          visualStyle: "soft-rounded",
          palette: "business-blue",
        },
        slides: [
          slide,
          { id: "s2", layout: "content" as const, title: "第二页" },
        ],
        createdAt: 0,
        updatedAt: 0,
      },
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
    useDeckStore.getState().updateSlideSvgLive(0, "<svg/>");
    const state = useDeckStore.getState();
    expect(state.deck!.slides[0].svg).toBe("<svg/>");
    expect(state.deck!.slides[0].svgStale).toBe(false);
    expect(state.deck!.slides[1].svg).toBeUndefined();
    // 静默：不进入历史
    expect(state.past).toHaveLength(0);
    expect(state.canUndo).toBe(false);
  });

  it("索引越界为 no-op", () => {
    const slide = { id: "s1", layout: "content" as const, title: "标题" };
    useDeckStore.setState({
      deck: {
        id: "d",
        version: 2,
        title: "t",
        design: {
          mode: "briefing",
          visualStyle: "soft-rounded",
          palette: "business-blue",
        },
        slides: [slide],
        createdAt: 0,
        updatedAt: 0,
      },
      past: [],
      future: [],
    });
    useDeckStore.getState().updateSlideSvgLive(5, "<svg/>");
    expect(useDeckStore.getState().deck!.slides[0].svg).toBeUndefined();
  });
});
