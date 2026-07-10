import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM layer so we don't hit the network
vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
}));

import { chat } from "@/services/llm";
import { generateOutline } from "@/services/outline";

const VALID_OUTLINE = JSON.stringify([
  {
    title: "测试主题汇报",
    layout: "cover",
    subtitle: "副标题",
  },
  {
    title: "目录",
    layout: "content",
    bullets: [{ text: "第一部分", level: 0 }],
  },
  {
    title: "数据概览",
    layout: "chart",
    chart: {
      type: "bar",
      title: "示例图表",
      data: [
        { label: "A", value: 10 },
        { label: "B", value: 20 },
      ],
    },
  },
  {
    title: "结尾",
    layout: "closing",
  },
]);

describe("generateOutline 集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: VALID_OUTLINE,
    });
  });

  it("解析 LLM 返回的合法大纲", async () => {
    const slides = await generateOutline({ topic: "测试主题" });
    expect(slides).toHaveLength(4);
    expect(slides[0].layout).toBe("cover");
    expect(slides[3].layout).toBe("closing");
  });

  it("每页都注入了 id", async () => {
    const slides = await generateOutline({ topic: "测试主题" });
    for (const s of slides) {
      expect(s.id).toBeTruthy();
    }
    // id 唯一
    const ids = new Set(slides.map((s) => s.id));
    expect(ids.size).toBe(slides.length);
  });

  it("bullets 注入了 id", async () => {
    const slides = await generateOutline({ topic: "测试主题" });
    const content = slides.find((s) => s.layout === "content");
    expect(content?.bullets?.[0].id).toBeTruthy();
  });

  it("支持从 markdown 代码块提取 JSON", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: "```json\n" + VALID_OUTLINE + "\n```",
    });
    const slides = await generateOutline({ topic: "测试主题" });
    expect(slides).toHaveLength(4);
  });

  it("LLM 返回非法 JSON 时抛错", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: "这不是 JSON",
    });
    await expect(generateOutline({ topic: "测试主题" })).rejects.toThrow();
  });

  it("超过一半页无效时整体失败", async () => {
    const bad = JSON.stringify([
      { title: "ok", layout: "cover" },
      { foo: "bar" },
      { baz: "qux" },
    ]);
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: bad,
    });
    await expect(generateOutline({ topic: "测试主题" })).rejects.toThrow();
  });

  it("上下文提示词注入模板结构", async () => {
    const contextualPrompt = "模板结构：\n1. [cover] 封面\n2. [content] 正文";
    await generateOutline({
      topic: "测试主题",
      contextualPrompt,
    });
    const callArg = (chat as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.messages[0].content).toContain("模板结构");
    expect(callArg.messages[0].content).toContain("[cover]");
  });
});
