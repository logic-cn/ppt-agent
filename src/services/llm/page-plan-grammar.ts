import { z } from "zod/v4";
import { SEMANTIC_ROLES, type SemanticRole } from "@/types/page-plan";

/**
 * pagePlan 的结构单一来源：既是运行时校验 schema，也用于
 * 本地模型 grammar 约束解码（zod → JSON Schema → GBNF）。
 */
export const pagePlanItemSchema = z.object({
  role: z.enum(SEMANTIC_ROLES as [SemanticRole, ...SemanticRole[]]),
  title: z.string(),
  intent: z.string(),
  bullets: z.array(z.string()).optional(),
  chartType: z.enum(["bar", "pie", "line", "doughnut"]).optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  notes: z.string().optional(),
});

/** 要求模型输出裸数组（parsePlanJson 对裸数组直接接受） */
export const pagePlanArraySchema = z.array(pagePlanItemSchema);

/** 与 pageplan prompt 约定一致：顶层为 {"pages":[...]} */
export const pagePlanRootSchema = z.object({
  pages: pagePlanArraySchema,
});

/**
 * 传给本地 provider 作 grammar 约束的 JSON Schema。
 * 结构合法率 100%，模型只负责内容；远程 provider 忽略此对象。
 */
export const pagePlanJsonSchema: unknown = z.toJSONSchema(pagePlanRootSchema);

interface PagePlanJsonSchemaShape {
  properties?: { pages?: Record<string, unknown> };
}

/**
 * 按目标页数生成 grammar 约束 schema：把 pages 数组锁成「恰好 N 项」。
 *
 * 端侧模型实测会在数组里提前收尾（约束解码只保证 JSON 结构合法，不保证
 * 页数），于是请求 7 页只拿到 1–2 页，整份 deck 直接少页。有了
 * minItems/maxItems，grammar 会强制模型补齐到 N 页——确定性且不额外花 token。
 * 不传页数时保持原 schema（页数由模型自定时仍允许自由发挥）。
 *
 * N ≥ 2 时进一步用元组式 items（JSON Schema 数组形式，llama.cpp 转换器支持）
 * 把首项 role 锁为 cover、末项 role 锁为 closing：提示词里的「最后一页必须是
 * closing」对 2B 端侧模型基本无效——页数锁死后模型会把结尾页挤成正文页，
 * require_closing 硬伤在每次端侧实跑都出现。约束解码是唯一确定性的收尾保证。
 */
export function buildPagePlanJsonSchema(pageCount?: number): unknown {
  if (!pageCount || pageCount < 1) return pagePlanJsonSchema;
  const base = z.toJSONSchema(pagePlanRootSchema) as PagePlanJsonSchemaShape;
  const pages = base.properties?.pages ?? {};
  const itemSchema = (pages as { items?: Record<string, unknown> }).items;
  // 单页 deck 无法同时以 cover 开头并以 closing 收尾（首页 gate 优先 cover）；
  // 结构异常时退回 minItems/maxItems 锁页数，不冒险下发未知形态
  if (pageCount < 2 || typeof itemSchema !== "object" || itemSchema === null) {
    return {
      ...base,
      properties: {
        ...base.properties,
        pages: { ...pages, minItems: pageCount, maxItems: pageCount },
      },
    };
  }
  const withRoleConst = (role: "cover" | "closing") => ({
    ...itemSchema,
    properties: {
      ...(itemSchema.properties ?? {}),
      role: { type: "string", const: role },
    },
  });
  return {
    ...base,
    properties: {
      ...base.properties,
      pages: {
        ...pages,
        items: [
          withRoleConst("cover"),
          ...Array.from({ length: pageCount - 2 }, () => itemSchema),
          withRoleConst("closing"),
        ],
      },
    },
  };
}
