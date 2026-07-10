import { describe, it, expect } from "vitest";
import {
  applyDeckPatches,
  dryRunDeckPatches,
} from "@/services/deck-patch/apply";
import type { Deck } from "@/types/deck";
import type { DeckPatch, SlideDraft } from "@/services/deck-patch/types";

function createMockDeck(overrides?: Partial<Deck>): Deck {
  return {
    id: "test-deck",
    version: 1,
    title: "测试 Deck",
    themeId: "business-blue",
    slides: [
      { id: "s1", layout: "cover", title: "封面" },
      {
        id: "s2",
        layout: "content",
        title: "市场分析",
        bullets: [{ id: "b1", text: "要点1", level: 0 }],
      },
      {
        id: "s3",
        layout: "chart",
        title: "数据对比",
        chart: { type: "bar", data: [{ label: "A", value: 10 }] },
      },
      { id: "s4", layout: "closing", title: "总结" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeSlideDraft(overrides?: Partial<SlideDraft>): SlideDraft {
  return {
    layout: "content",
    title: "新页面",
    bullets: [{ text: "bullet 1", level: 0 }],
    ...overrides,
  };
}

describe("applyDeckPatches", () => {
  it("set_deck_title 修改标题", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [{ op: "set_deck_title", title: "新标题" }];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.title).toBe("新标题");
    expect(result.applied).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("insert_slide 在指定位置插入", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      {
        op: "insert_slide",
        index: 1,
        slide: makeSlideDraft({ title: "插入页" }),
      },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(5);
    expect(result.deck.slides[1].title).toBe("插入页");
    expect(result.deck.slides[2].title).toBe("市场分析");
  });

  it("insert_slide index 小于 0 时按 0 处理", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "insert_slide", index: -1, slide: makeSlideDraft() },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides[0].title).toBe("新页面");
  });

  it("insert_slide index 超出范围时追加并给出 warning", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "insert_slide", index: 100, slide: makeSlideDraft() },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(5);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("index_out_of_range");
  });

  it("delete_slide 删除指定页面", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [{ op: "delete_slide", slideId: "s2" }];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(3);
    expect(
      result.deck.slides.find((s: { id: string }) => s.id === "s2"),
    ).toBeUndefined();
  });

  it("delete_slide 引用不存在 slideId 时给出致命 warning", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "delete_slide", slideId: "nonexistent" },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(4);
    // delete_slide 是 destructive 操作，同时 slide_not_found 产生致命 warning
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.code === "slide_not_found")).toBe(
      true,
    );
    expect(result.warnings.some((w) => w.fatal)).toBe(true);
  });

  it("move_slide 移动页面", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "move_slide", slideId: "s4", toIndex: 0 },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides[0].title).toBe("总结");
    expect(result.deck.slides[1].title).toBe("封面");
  });

  it("update_slide 修改页面字段", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      {
        op: "update_slide",
        slideId: "s2",
        patch: { title: "更新标题", layout: "two-column" },
      },
    ];
    const result = applyDeckPatches(deck, patches);
    const slide = result.deck.slides.find(
      (s: { id: string }) => s.id === "s2",
    )!;
    expect(slide.title).toBe("更新标题");
    expect(slide.layout).toBe("two-column");
  });

  it("replace_slide 替换页面", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      {
        op: "replace_slide",
        slideId: "s2",
        slide: makeSlideDraft({ title: "替换页" }),
      },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(4);
    const slide = result.deck.slides.find(
      (s: { id: string }) => s.id !== "s1" && s.id !== "s3" && s.id !== "s4",
    )!;
    expect(slide.title).toBe("替换页");
  });

  it("split_slide 拆分页面", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      {
        op: "split_slide",
        slideId: "s2",
        slides: [
          makeSlideDraft({ title: "拆分页1" }),
          makeSlideDraft({ title: "拆分页2" }),
        ],
      },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(5);
    // s2 被替换为两页新页面
    expect(result.deck.slides[1].title).toBe("拆分页1");
    expect(result.deck.slides[2].title).toBe("拆分页2");
  });

  it("merge_slides 合并页面", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      {
        op: "merge_slides",
        slideIds: ["s2", "s3"],
        slide: makeSlideDraft({ title: "合并页" }),
      },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(3);
    expect(result.deck.slides[1].title).toBe("合并页");
  });

  it("失败不修改原 deck（原子性回滚）", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "delete_slide", slideId: "nonexistent" },
      { op: "delete_slide", slideId: "s2" },
    ];
    // 存在引用不存在的 slideId，整批 patch 不应应用，原 deck 保持 4 页
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides).toHaveLength(4);
    expect(result.applied).toHaveLength(0);
    expect(result.warnings.some((w) => w.fatal)).toBe(true);
    // 原 deck 不受影响
    expect(deck.slides).toHaveLength(4);
  });

  it("单个 patch 失败不影响其它合法 patch（非原子模式不适用）：整批回滚", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "set_deck_title", title: "新标题" },
      { op: "delete_slide", slideId: "nonexistent" },
    ];
    const result = applyDeckPatches(deck, patches);
    // 标题修改也随整批一起回滚
    expect(result.deck.title).toBe("测试 Deck");
    expect(result.applied).toHaveLength(0);
  });

  it("全部合法 patch 正常应用", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "set_deck_title", title: "新标题" },
      { op: "delete_slide", slideId: "s2" },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.title).toBe("新标题");
    expect(result.deck.slides).toHaveLength(3);
    expect(result.warnings.some((w) => w.fatal)).toBe(false);
  });

  it("destructive 操作给出 warning", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "delete_slide", slideId: "s2" },
      { op: "replace_slide", slideId: "s3", slide: makeSlideDraft() },
    ];
    const result = applyDeckPatches(deck, patches);
    const destructiveWarnings = result.warnings.filter(
      (w) => w.code === "destructive_operation",
    );
    expect(destructiveWarnings).toHaveLength(2);
  });

  it("新页面自动生成 id", () => {
    const deck = createMockDeck();
    const patches: DeckPatch[] = [
      { op: "insert_slide", index: 0, slide: makeSlideDraft() },
    ];
    const result = applyDeckPatches(deck, patches);
    expect(result.deck.slides[0].id).toBeTruthy();
    expect(result.deck.slides[0].id).not.toBe("");
  });
});

describe("dryRunDeckPatches", () => {
  it("不修改原 deck", () => {
    const deck = createMockDeck();
    const originalSlidesCount = deck.slides.length;
    const patches: DeckPatch[] = [{ op: "delete_slide", slideId: "s2" }];
    const result = dryRunDeckPatches(deck, patches);
    expect(result.applied).toHaveLength(1);
    expect(deck.slides).toHaveLength(originalSlidesCount);
  });
});
