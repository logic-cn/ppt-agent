import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
}));

import { chat } from "@/services/llm";
import { generateSlideContent, buildContentContext } from "@/services/content";
import type { Deck } from "@/types/deck";
import { DEFAULT_DESIGN } from "@/types/design";

function createDeck(): Deck {
  return {
    id: "d1",
    version: 2,
    title: "Q3 复盘",
    themeId: "business-blue",
    slides: [
      { id: "s1", layout: "cover", title: "封面" },
      { id: "s2", layout: "content", title: "市场分析" },
      { id: "s3", layout: "closing", title: "结尾" },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

const VALID = JSON.stringify({
  body: "本页分析市场格局。",
  bullets: [
    { text: "头部厂商占 45%", level: 0 },
    {
      text: "中型厂商差异化",
      level: 0,
      children: [{ text: "聚焦垂直行业", level: 1 }],
    },
  ],
  chart: {
    type: "bar",
    title: "份额",
    data: [
      { label: "A", value: 45 },
      { label: "B", value: 30 },
    ],
  },
});

describe("buildContentContext", () => {
  it("包含演示主题与其他页面标题", () => {
    const deck = createDeck();
    const ctx = buildContentContext(deck, deck.slides[1]);
    expect(ctx).toContain("Q3 复盘");
    expect(ctx).toContain("封面");
    expect(ctx).toContain("结尾");
    expect(ctx).not.toContain("市场分析");
  });
});

describe("generateSlideContent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("解析合法 JSON 并为本页要点补 id", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: VALID,
    });
    const result = await generateSlideContent({
      slideTitle: "市场分析",
      context: "ctx",
      design: DEFAULT_DESIGN,
    });
    expect(result.body).toBe("本页分析市场格局。");
    expect(result.bullets).toHaveLength(2);
    expect(result.bullets![0].id).toBeTruthy();
    expect(result.bullets![1].children![0].id).toBeTruthy();
    expect(result.chart?.data).toHaveLength(2);
  });

  it("非法 JSON 时整体作为 body 回退", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "这是一段纯文本正文",
    });
    const result = await generateSlideContent({
      slideTitle: "x",
      context: "c",
      design: DEFAULT_DESIGN,
    });
    expect(result.body).toBe("这是一段纯文本正文");
    expect(result.bullets).toBeUndefined();
  });

  it("markdown 代码块包裹的 JSON 也能提取", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "```json\n" + VALID + "\n```",
    });
    const result = await generateSlideContent({
      slideTitle: "x",
      context: "c",
      design: DEFAULT_DESIGN,
    });
    expect(result.body).toBe("本页分析市场格局。");
    expect(result.chart).toBeDefined();
  });

  it("结构化 JSON 但字段非法时抛错而非写入原始输出", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: JSON.stringify({ chart: { type: "bar", data: "not-array" } }),
    });
    await expect(
      generateSlideContent({
        slideTitle: "x",
        context: "c",
        design: DEFAULT_DESIGN,
      }),
    ).rejects.toThrow();
  });
});
