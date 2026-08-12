import { describe, it, expect } from "vitest";
import { applyAutoFixActions } from "@/services/quality/auto-fix";
import type { Deck, Slide } from "@/types/deck";
import type { AutoFixAction } from "@/services/quality";

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

function slide(overrides: Partial<Slide>): Slide {
  return { id: "s1", layout: "content", title: "内容", ...overrides };
}

describe("applyAutoFixActions", () => {
  it("set_title：为空标题页填充占位标题", () => {
    const deck = createMockDeck({
      slides: [slide({ id: "s1", title: "" })],
    });
    const actions: AutoFixAction[] = [
      {
        type: "set_title",
        slideId: "s1",
        description: "为空白标题页生成占位标题",
      },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides[0].title.trim()).not.toBe("");
    expect(fixed.slides[0].id).toBe("s1");
  });

  it("set_title：标题已非空时原样保留", () => {
    const deck = createMockDeck({
      slides: [slide({ id: "s1", title: "已有标题" })],
    });
    const actions: AutoFixAction[] = [
      { type: "set_title", slideId: "s1", description: "占位" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides[0].title).toBe("已有标题");
  });

  it("remove_empty_bullet：删除空要点、保留非空要点", () => {
    const deck = createMockDeck({
      slides: [
        slide({
          id: "s1",
          bullets: [
            { id: "b1", text: "有效要点", level: 0 },
            { id: "b2", text: "   ", level: 0 },
            { id: "b3", text: "", level: 1 },
          ],
        }),
      ],
    });
    const actions: AutoFixAction[] = [
      { type: "remove_empty_bullet", slideId: "s1", description: "删除空要点" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides[0].bullets!.map((b) => b.id)).toEqual(["b1"]);
  });

  it("change_layout：无数据图表页改为正文布局并丢弃 chart", () => {
    const deck = createMockDeck({
      slides: [
        slide({
          id: "s1",
          layout: "chart",
          title: "图表",
          chart: { type: "bar", data: [] },
        }),
      ],
    });
    const actions: AutoFixAction[] = [
      { type: "change_layout", slideId: "s1", description: "改为正文布局" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides[0].layout).toBe("content");
    expect(fixed.slides[0].chart).toBeUndefined();
  });

  it("change_layout：跳过非图表页", () => {
    const deck = createMockDeck({
      slides: [slide({ id: "s1", layout: "content", title: "正文" })],
    });
    const actions: AutoFixAction[] = [
      { type: "change_layout", slideId: "s1", description: "改布局" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides[0].layout).toBe("content");
  });

  it("append_closing：末尾非结尾页时追加结尾页", () => {
    const deck = createMockDeck({
      slides: [
        slide({ id: "s1", layout: "cover", title: "封面" }),
        slide({ id: "s2", layout: "content", title: "内容" }),
      ],
    });
    const actions: AutoFixAction[] = [
      { type: "append_closing", description: "追加结尾页" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides).toHaveLength(3);
    expect(fixed.slides[2].layout).toBe("closing");
    expect(fixed.slides[2].title.trim()).not.toBe("");
  });

  it("append_closing：已以结尾页收尾时不再追加", () => {
    const deck = createMockDeck({
      slides: [
        slide({ id: "s1", layout: "cover", title: "封面" }),
        slide({ id: "s2", layout: "closing", title: "谢谢观看" }),
      ],
    });
    const actions: AutoFixAction[] = [
      { type: "append_closing", description: "追加结尾页" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides).toHaveLength(2);
  });

  it("没有可执行动作时原样返回（不产生新对象）", () => {
    const deck = createMockDeck({
      slides: [slide({ id: "s1", title: "已有标题", layout: "content" })],
    });
    const actions: AutoFixAction[] = [
      { type: "set_title", slideId: "s1", description: "占位" },
    ];
    expect(applyAutoFixActions(deck, actions)).toBe(deck);
  });

  it("不修改输入 deck（纯函数）", () => {
    const deck = createMockDeck({
      slides: [
        slide({
          id: "s1",
          title: "",
          bullets: [{ id: "b1", text: "", level: 0 }],
        }),
      ],
    });
    const before = JSON.stringify(deck);
    const actions: AutoFixAction[] = [
      { type: "set_title", slideId: "s1", description: "占位" },
      { type: "remove_empty_bullet", slideId: "s1", description: "删空" },
    ];
    applyAutoFixActions(deck, actions);
    expect(JSON.stringify(deck)).toBe(before);
  });

  it("change_layout：图表页有数据时保留布局", () => {
    const deck = createMockDeck({
      slides: [
        slide({
          id: "s1",
          layout: "chart",
          title: "图表",
          chart: { type: "bar", data: [{ label: "A", value: 1 }] },
        }),
      ],
    });
    const actions: AutoFixAction[] = [
      { type: "change_layout", slideId: "s1", description: "改布局" },
    ];
    expect(applyAutoFixActions(deck, actions)).toBe(deck);
  });

  it("同一页多个动作按序叠加且各自生效", () => {
    const deck = createMockDeck({
      slides: [
        slide({
          id: "s1",
          title: "",
          layout: "chart",
          chart: { type: "bar", data: [] },
        }),
      ],
    });
    const actions: AutoFixAction[] = [
      { type: "set_title", slideId: "s1", description: "占位" },
      { type: "change_layout", slideId: "s1", description: "改布局" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides[0].title.trim()).not.toBe("");
    expect(fixed.slides[0].layout).toBe("content");
    expect(fixed.slides[0].chart).toBeUndefined();
  });

  it("append_closing：空 deck 追加唯一结尾页", () => {
    const deck = createMockDeck({ slides: [] });
    const actions: AutoFixAction[] = [
      { type: "append_closing", description: "追加结尾页" },
    ];
    const fixed = applyAutoFixActions(deck, actions);
    expect(fixed.slides).toHaveLength(1);
    expect(fixed.slides[0].layout).toBe("closing");
  });

  it("空动作列表时原样返回", () => {
    const deck = createMockDeck({ slides: [slide({})] });
    expect(applyAutoFixActions(deck, [])).toBe(deck);
  });
});
