import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
  isLocalModelActive: vi.fn(() => true),
}));

import { chat } from "@/services/llm";
import { generatePagePlan } from "@/services/outline";
import { buildPagePlanJsonSchema } from "@/services/llm/page-plan-grammar";
import { DEFAULT_DESIGN } from "@/types/design";

function pagesSchemaOf(schema: unknown): Record<string, unknown> {
  return (schema as { properties: { pages: Record<string, unknown> } })
    .properties.pages;
}

describe("buildPagePlanJsonSchema", () => {
  it("不传页数时返回原 schema（页数自由）", () => {
    const schema = buildPagePlanJsonSchema(undefined) as {
      properties: { pages: Record<string, unknown> };
    };
    expect(schema.properties.pages.minItems).toBeUndefined();
    expect(schema.properties.pages.maxItems).toBeUndefined();
  });

  it("传页数时把 pages 锁成恰好 N 项", () => {
    const schema = buildPagePlanJsonSchema(7) as {
      properties: { pages: Record<string, unknown> };
    };
    expect(schema.properties.pages.minItems).toBe(7);
    expect(schema.properties.pages.maxItems).toBe(7);
  });

  it("保留 items 结构（模型仍只能产出合法 pagePlan 项）", () => {
    const schema = buildPagePlanJsonSchema(5) as {
      properties: { pages: { items: Record<string, unknown> } };
    };
    expect(schema.properties.pages.items).toBeTruthy();
    expect(schema.properties.pages.items.type).toBe("object");
  });
});

describe("generatePagePlan · 本地档页数约束", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: JSON.stringify({
        pages: [
          { role: "cover", title: "封面", intent: "定调" },
          { role: "content", title: "正文", intent: "展开" },
        ],
      }),
    });
  });

  it("把目标页数写进 grammar schema（端侧模型提前收尾的根因修复）", async () => {
    await generatePagePlan({
      topic: "测试主题",
      design: DEFAULT_DESIGN,
      pageCount: 6,
    });
    const req = (chat as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const pages = pagesSchemaOf(req.jsonSchema);
    expect(pages.minItems).toBe(6);
    expect(pages.maxItems).toBe(6);
  });

  it("本地档按页数放大 token 预算（避免 JSON 被截断）", async () => {
    await generatePagePlan({
      topic: "测试主题",
      design: DEFAULT_DESIGN,
      pageCount: 10,
    });
    const req = (chat as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(req.maxTokens).toBeGreaterThanOrEqual(4000);
  });
});
