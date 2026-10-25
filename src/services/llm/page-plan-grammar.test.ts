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

  it("传页数时把 pages 锁成恰好 N 项（元组式 items）", () => {
    const schema = buildPagePlanJsonSchema(7) as {
      properties: { pages: { items: unknown[] } };
    };
    expect(Array.isArray(schema.properties.pages.items)).toBe(true);
    expect(schema.properties.pages.items).toHaveLength(7);
  });

  it("元组首项 role 锁 cover、末项锁 closing（require_closing 的确定性修复）", () => {
    const schema = buildPagePlanJsonSchema(5) as {
      properties: {
        pages: {
          items: Array<{ properties: { role: Record<string, unknown> } }>;
        };
      };
    };
    const [first, , , , last] = schema.properties.pages.items;
    expect(first.properties.role).toEqual({ type: "string", const: "cover" });
    expect(last.properties.role).toEqual({ type: "string", const: "closing" });
  });

  it("元组中间项保留完整 role 枚举与页面结构", () => {
    const schema = buildPagePlanJsonSchema(5) as {
      properties: { pages: { items: Array<Record<string, unknown>> } };
    };
    const middle = schema.properties.pages.items[2]!;
    expect(middle.type).toBe("object");
    const role = (middle.properties as Record<string, unknown>).role as Record<
      string,
      unknown
    >;
    expect(role.const).toBeUndefined();
    expect(role.enum as string[]).toContain("content");
    expect(role.enum as string[]).toContain("closing");
  });

  it("单页 deck 退回 minItems/maxItems=1（无法同时 cover 开头与 closing 收尾）", () => {
    const schema = buildPagePlanJsonSchema(1) as {
      properties: { pages: Record<string, unknown> };
    };
    expect(schema.properties.pages.minItems).toBe(1);
    expect(schema.properties.pages.maxItems).toBe(1);
  });

  it("两页 deck 锁成 [cover, closing]", () => {
    const schema = buildPagePlanJsonSchema(2) as {
      properties: {
        pages: {
          items: Array<{ properties: { role: Record<string, unknown> } }>;
        };
      };
    };
    expect(schema.properties.pages.items).toHaveLength(2);
    expect(schema.properties.pages.items[0]!.properties.role.const).toBe(
      "cover",
    );
    expect(schema.properties.pages.items[1]!.properties.role.const).toBe(
      "closing",
    );
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
    expect(pages.items).toHaveLength(6);
    const first = (
      pages.items as Array<{ properties: { role: Record<string, unknown> } }>
    )[0]!.properties.role;
    expect(first).toEqual({ type: "string", const: "cover" });
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
