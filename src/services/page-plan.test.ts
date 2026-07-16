import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM layer so we don't hit the network
vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
}));

import { chat } from "@/services/llm";
import { generatePagePlan } from "@/services/outline";
import { DEFAULT_DESIGN } from "@/types/design";

const VALID_PLAN = JSON.stringify({
  pages: [
    { role: "cover", title: "年度增长复盘", intent: "封面，点明主题" },
    {
      role: "section",
      title: "一、市场背景",
      intent: "章节过渡，引入市场背景",
    },
    {
      role: "content",
      title: "市场规模与增速",
      intent: "用要点说明市场规模与增长动力",
      bullets: ["市场规模 970 亿美元", "近三年 CAGR 18%", "政策与需求双驱动"],
    },
    {
      role: "metrics",
      title: "核心指标",
      intent: "突出关键增长数字",
      chartType: "bar",
    },
    {
      role: "quote",
      title: "核心判断",
      intent: "用金句表达核心结论",
      quote: "增长的本质是结构性迁移。",
      attribution: "内部研判",
    },
    { role: "closing", title: "谢谢", intent: "结尾页" },
  ],
});

describe("generatePagePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: VALID_PLAN,
    });
  });

  it("解析 LLM 返回的语义角色数组", async () => {
    const plan = await generatePagePlan({
      topic: "年度增长复盘",
      design: DEFAULT_DESIGN,
    });
    expect(plan).toHaveLength(6);
    expect(plan[0].role).toBe("cover");
    expect(plan[5].role).toBe("closing");
    expect(plan[2].bullets).toBeDefined();
    expect(plan[3].chartType).toBe("bar");
  });

  it("角色分布合理：至少含 cover 与 closing 且首尾正确", async () => {
    const plan = await generatePagePlan({
      topic: "年度增长复盘",
      design: DEFAULT_DESIGN,
    });
    const roles = plan.map((p) => p.role);
    expect(roles[0]).toBe("cover");
    expect(roles[roles.length - 1]).toBe("closing");
    expect(roles).toContain("content");
  });

  it("支持从 markdown 代码块提取 JSON", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: "```json\n" + VALID_PLAN + "\n```",
    });
    const plan = await generatePagePlan({
      topic: "年度增长复盘",
      design: DEFAULT_DESIGN,
    });
    expect(plan).toHaveLength(6);
  });

  it("超过一半页含非法角色时报错", async () => {
    const bad = JSON.stringify({
      pages: [
        { role: "cover", title: "x", intent: "y" },
        { role: "banana", title: "z", intent: "w" },
        { role: "apple", title: "q", intent: "r" },
      ],
    });
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: bad,
    });
    await expect(
      generatePagePlan({ topic: "t", design: DEFAULT_DESIGN }),
    ).rejects.toThrow();
  });

  it("LLM 返回非法 JSON 时抛错", async () => {
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: "这不是 JSON",
    });
    await expect(
      generatePagePlan({ topic: "t", design: DEFAULT_DESIGN }),
    ).rejects.toThrow();
  });
});
