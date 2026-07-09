import { describe, it, expect, beforeEach } from "vitest";
import { applyUserIntent } from "@/services/intent-parser";
import { useDeckStore } from "@/store/deck";

// 助手：设置一个 mock deck
function setupMockDeck() {
  useDeckStore.setState({
    deck: {
      id: "test",
      title: "测试",
      themeId: "business-blue",
      slides: [
        { id: "s1", layout: "cover", title: "封面" },
        {
          id: "s2",
          layout: "content",
          title: "市场分析",
          bullets: [
            { id: "b1", text: "要点1", level: 0 },
            { id: "b2", text: "要点2", level: 0 },
          ],
        },
        { id: "s3", layout: "chart", title: "数据对比" },
        { id: "s4", layout: "closing", title: "结尾" },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
}

describe("applyUserIntent", () => {
  beforeEach(() => {
    setupMockDeck();
  });

  it("删除指定页面", () => {
    const result = applyUserIntent("删掉第2页");
    expect(result.action).toBe("modify");
    expect(result.reply).toContain("已删除");
    const slides = useDeckStore.getState().deck!.slides;
    expect(slides.length).toBe(3);
    expect(slides[0].title).toBe("封面");
    expect(slides[1].title).toBe("数据对比");
  });

  it("修改页面布局为双栏", () => {
    const result = applyUserIntent("把第2页改成双栏");
    expect(result.action).toBe("modify");
    expect(result.reply).toContain("双栏");
    const slides = useDeckStore.getState().deck!.slides;
    expect(slides[1].layout).toBe("two-column");
  });

  it("新增页面", () => {
    const result = applyUserIntent("加一页竞品分析");
    expect(result.action).toBe("modify");
    expect(result.reply).toContain("竞品分析");
    const slides = useDeckStore.getState().deck!.slides;
    expect(slides.length).toBe(5);
    expect(slides[4].title).toBe("竞品分析");
  });

  it("新增图表页面", () => {
    const result = applyUserIntent("加一页营收图表");
    expect(result.action).toBe("modify");
    const slides = useDeckStore.getState().deck!.slides;
    expect(slides[slides.length - 1].layout).toBe("chart");
  });

  it("移动页面", () => {
    const result = applyUserIntent("把第3页移到第2页前");
    expect(result.action).toBe("modify");
    const slides = useDeckStore.getState().deck!.slides;
    expect(slides[1].title).toBe("数据对比");
  });

  it("给指定页添加要点", () => {
    const result = applyUserIntent("给第2页添加要点：新增要点测试");
    expect(result.action).toBe("modify");
    const slide = useDeckStore.getState().deck!.slides[1];
    expect(slide.bullets?.length).toBe(3);
    expect(slide.bullets?.[2].text).toBe("新增要点测试");
  });

  it("未知指令返回 unknown", () => {
    const result = applyUserIntent("你好");
    expect(result.action).toBe("unknown");
  });
});
