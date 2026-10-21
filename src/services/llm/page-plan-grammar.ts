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
 */
export function buildPagePlanJsonSchema(pageCount?: number): unknown {
  if (!pageCount || pageCount < 1) return pagePlanJsonSchema;
  const base = z.toJSONSchema(pagePlanRootSchema) as PagePlanJsonSchemaShape;
  const pages = base.properties?.pages ?? {};
  return {
    ...base,
    properties: {
      ...base.properties,
      pages: { ...pages, minItems: pageCount, maxItems: pageCount },
    },
  };
}
