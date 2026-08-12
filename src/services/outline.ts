import { z } from "zod/v4";
import { chat } from "./llm";
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
} from "./llm/prompts/outline";
import {
  buildPagePlanSystemPrompt,
  buildPagePlanUserPrompt,
} from "./llm/prompts/pageplan";
import type { BulletNode, Slide, SlideLayout } from "@/types/deck";
import { SLIDE_LAYOUTS } from "@/types/layouts";
import type { TemplateGenerationContext } from "@/presets/template-context";
import type { DesignLock } from "@/types/design";
import { isDesignLock } from "@/types/design";
import { PagePlanItem, SEMANTIC_ROLES, SemanticRole } from "@/types/page-plan";
import { selectFewShot, buildFewShotPrompt } from "./llm/few-shot";
import { nanoid } from "nanoid";

// ---- pagePlan（页面结构规划）相关 schema ----

const pagePlanItemSchema = z.object({
  role: z.enum(SEMANTIC_ROLES as [SemanticRole, ...SemanticRole[]]),
  title: z.string(),
  intent: z.string(),
  bullets: z.array(z.string()).optional(),
  chartType: z.enum(["bar", "pie", "line", "doughnut"]).optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
});

/**
 * 解析 LLM 返回的 JSON（兼容裸数组、{"pages":[...]}、markdown 代码块）。
 * 返回规整后的未知对象数组，交由调用方用 zod 逐项校验。
 */
function parsePlanJson(content: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error(`LLM 返回的 JSON 无法解析：${content.slice(0, 200)}`);
      }
    } else {
      throw new Error(`LLM 返回的 JSON 无法解析：${content.slice(0, 200)}`);
    }
  }

  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.pages)) return obj.pages;
    // 退化：找到首个角色数组
    const candidate = Object.values(obj).find(
      (v) =>
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === "object" &&
        v[0] !== null &&
        typeof (v[0] as Record<string, unknown>).role === "string",
    );
    if (candidate) return candidate;
    // 单个对象
    if (typeof obj.role === "string") return [obj];
  }
  throw new Error(`页面结构规划返回格式无法识别：${content.slice(0, 200)}`);
}

/** 递归为 bullet 节点添加 id（支持任意层级） */
function addBulletIds(
  nodes: {
    text: string;
    level: number;
    children?: { text: string; level: number }[];
  }[],
): BulletNode[] {
  return nodes.map((n) => ({
    id: nanoid(),
    text: n.text,
    level: Math.min(n.level, 2) as 0 | 1 | 2,
    children: n.children ? addBulletIds(n.children) : undefined,
  }));
}

const bulletNodeSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  children: z
    .array(
      z.object({
        text: z.string(),
        level: z.union([z.literal(1), z.literal(2)]),
      }),
    )
    .optional(),
});

const slideContentItemSchema = z.object({
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  body: z.string().optional(),
});

const slideSchema = z.object({
  title: z.string(),
  layout: z.enum(SLIDE_LAYOUTS),
  subtitle: z.string().optional(),
  bullets: z.array(bulletNodeSchema).optional(),
  items: z.array(slideContentItemSchema).optional(),
  chart: z
    .object({
      type: z.enum(["bar", "pie", "line", "doughnut"]),
      title: z.string().optional(),
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    })
    .optional(),
  metric: z
    .object({
      value: z.string(),
      unit: z.string().optional(),
      label: z.string(),
      kicker: z.string().optional(),
    })
    .optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
});

/**
 * 生成页面结构规划（pagePlan）。
 * 输入主题/文档/设计锁 → LLM JSON mode → 校验 → 返回 PagePlanItem[]。
 * 仅产出「每页语义角色与内容规划」，不含像素坐标（后续 executor 负责）。
 * 复用现有 chat 调用范式与设计锁注入方式。
 */
export async function generatePagePlan(params: {
  topic: string;
  design: DesignLock;
  audience?: string;
  pageCount?: number;
  docContent?: string;
  signal?: AbortSignal;
  templateCtx?: TemplateGenerationContext;
}): Promise<PagePlanItem[]> {
  const design = params.design;
  if (!isDesignLock(design)) {
    throw new Error("generatePagePlan 需要合法的 DesignLock");
  }

  const systemPrompt = buildPagePlanSystemPrompt({
    design,
    templateCtx: params.templateCtx,
    fewShot: buildFewShotPrompt(selectFewShot(design)),
  });
  const userPrompt = buildPagePlanUserPrompt(params);

  const res = await chat(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      responseFormat: "json",
      maxTokens: 4000,
      signal: params.signal,
    },
    "outline",
  );

  const raw = parsePlanJson(res.content);
  const rawArray = Array.isArray(raw) ? raw : [];

  const valid: PagePlanItem[] = [];
  for (const item of rawArray) {
    const result = pagePlanItemSchema.safeParse(item);
    if (result.success) valid.push(result.data);
  }

  if (valid.length === 0) {
    throw new Error("页面结构规划校验失败：所有页格式均不正确，请重试");
  }
  if (valid.length < rawArray.length * 0.5) {
    throw new Error(
      `页面结构规划校验失败：${rawArray.length} 页中有 ${valid.length} 页格式正确，正确率不足 50%`,
    );
  }

  return valid;
}

/**
 * 生成 PPT 大纲（旧链路）。
 * 输入主题/文档 → LLM JSON mode → 校验 → 附加 id → 返回 Slide[]
 *
 * @deprecated 已被 X1 管线的 buildDeckSvgs（SVG 设计真相中间层）取代。
 * 新代码请改用 buildDeckSvgs 以获得带 svg 的 Slide；此函数仅保留作兼容与测试。
 */
export async function generateOutline(params: {
  topic: string;
  design: DesignLock;
  audience?: string;
  pageCount?: number;
  docContent?: string;
  signal?: AbortSignal;
}): Promise<Slide[]> {
  const design = params.design;
  const systemPrompt = buildOutlineSystemPrompt({
    design,
    fewShot: buildFewShotPrompt(selectFewShot(design)),
  });
  const userPrompt = buildOutlineUserPrompt(params);

  const res = await chat(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      responseFormat: "json",
      maxTokens: 4000,
      signal: params.signal,
    },
    "outline",
  );

  // 解析 JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.content);
  } catch (e) {
    // 尝试从 markdown 代码块中提取
    const match = res.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error(
          `LLM 返回的 JSON 无法解析：${res.content.slice(0, 200)}`,
        );
      }
    } else {
      throw new Error(`LLM 返回的 JSON 无法解析：${res.content.slice(0, 200)}`);
    }
  }

  // 兼容 json_object 模式：模型禁止返回顶层数组，可能包裹为 {"slides": [...]}，
  // 或仅返回单个 slide 对象。此处统一规整为 Slide[]。
  if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const arrayCandidate = Object.values(obj).find(
      (v) =>
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === "object" &&
        v[0] !== null &&
        ("title" in v[0] || "layout" in v[0]),
    );
    if (arrayCandidate) {
      parsed = arrayCandidate;
    } else if (
      typeof obj.title === "string" &&
      typeof obj.layout === "string"
    ) {
      // 仅返回单个 slide 对象（json_object 模式下的退化输出）
      parsed = [obj];
    }
  }

  // 逐页校验，过滤无效幻灯片
  const rawSlides = Array.isArray(parsed) ? parsed : [];
  const validSlides: z.infer<typeof slideSchema>[] = [];
  for (const slide of rawSlides) {
    const result = slideSchema.safeParse(slide);
    if (result.success) {
      validSlides.push(result.data);
    }
  }

  if (validSlides.length === 0) {
    throw new Error(`大纲格式校验失败：所有幻灯片格式均不正确，请重试`);
  }

  // 超过 50% 页无效则整体失败（LLM 可能返回了错误格式）
  if (validSlides.length < rawSlides.length * 0.5) {
    throw new Error(
      `大纲格式校验失败：${rawSlides.length} 页中有 ${validSlides.length} 页格式正确，` +
        `正确率不足 50%，请重试`,
    );
  }

  if (validSlides.length < rawSlides.length) {
    console.warn(
      `过滤了 ${rawSlides.length - validSlides.length} 页格式异常的幻灯片`,
    );
  }

  // 预算后处理：软截断超限文案，避免渲染溢出
  const budgeted = validSlides.map((slide) => enforceBudget(slide));
  const truncatedCount = budgeted.filter((b) => b.truncated).length;
  if (truncatedCount > 0) {
    console.warn(
      `按文案预算软截断 ${truncatedCount} 页超限内容，以保证排版不溢出`,
    );
  }

  // 附加 id
  return budgeted.map(({ slide }) => ({
    ...slide,
    id: nanoid(),
    bullets: slide.bullets ? addBulletIds(slide.bullets) : undefined,
    items: slide.items
      ? slide.items.map((item) => ({
          ...item,
          id: nanoid(),
        }))
      : undefined,
  }));
}

/**
 * 各布局的文案预算。超出部分做软截断，保证渲染不溢出。
 */
interface BudgetEntry {
  title?: number;
  subtitle?: number;
  bulletMax?: number;
  bulletCount?: number;
  childMax?: number;
  itemBulletMax?: number;
  itemBulletCount?: number;
  /** 语义化布局的专属字段预算 */
  metricMax?: number;
  quoteMax?: number;
  timelineNodeMax?: number;
  timelineNodeTextMax?: number;
}

const BUDGET: Partial<Record<SlideLayout, BudgetEntry>> = {
  cover: { title: 16, subtitle: 30 },
  closing: { title: 16 },
  section: { subtitle: 40 },
  content: { bulletMax: 28, bulletCount: 6, childMax: 24 },
  "two-column": { itemBulletMax: 20, itemBulletCount: 3, bulletMax: 26 },
  chart: {},
  image: { bulletMax: 24, bulletCount: 4 },
  "cols-2": { itemBulletMax: 20, itemBulletCount: 3 },
  "cols-3": { itemBulletMax: 20, itemBulletCount: 3 },
  "cols-4": { itemBulletMax: 18, itemBulletCount: 3 },
  "cols-5": { itemBulletMax: 16, itemBulletCount: 3 },
  "cols-6": { itemBulletMax: 14, itemBulletCount: 3 },
  metrics: { metricMax: 12 },
  quote: { quoteMax: 40 },
  timeline: { timelineNodeMax: 5, timelineNodeTextMax: 18 },
};

function truncate(text: string, max: number): string {
  if (!max || text.length <= max) return text;
  return text.slice(0, max);
}

/**
 * 软截断超限文案，避免渲染溢出。返回截断后的 slide 与是否发生截断的标记。
 */
function enforceBudget(slide: z.infer<typeof slideSchema>): {
  slide: z.infer<typeof slideSchema>;
  truncated: boolean;
} {
  const b = BUDGET[slide.layout];
  if (!b) return { slide, truncated: false };

  let truncated = false;
  const mark = (cond: boolean) => {
    if (cond) truncated = true;
  };

  const next: typeof slide = { ...slide };

  if (b.title && next.title && next.title.length > b.title) {
    mark(true);
    next.title = truncate(next.title, b.title);
  }
  if (b.subtitle && next.subtitle && next.subtitle.length > b.subtitle) {
    mark(true);
    next.subtitle = truncate(next.subtitle, b.subtitle);
  }

  if (next.bullets && (b.bulletMax || b.bulletCount)) {
    const over =
      (b.bulletCount && next.bullets.length > b.bulletCount) ||
      next.bullets.some((bn) => bn.text.length > (b.bulletMax ?? 999));
    if (over) mark(true);
    let bullets = next.bullets;
    if (b.bulletCount) bullets = bullets.slice(0, b.bulletCount);
    bullets = bullets.map((bn) => ({
      ...bn,
      text: truncate(bn.text, b.bulletMax ?? 999),
      children: bn.children
        ? bn.children
            .slice(0, b.bulletCount ?? 999)
            .map((c) => ({ ...c, text: truncate(c.text, b.childMax ?? 999) }))
        : undefined,
    }));
    next.bullets = bullets;
  }

  if (next.items && (b.itemBulletMax || b.itemBulletCount)) {
    const over =
      (b.itemBulletCount && next.items.length > b.itemBulletCount) ||
      next.items.some((it) =>
        (it.bullets ?? []).some((t) => t.length > (b.itemBulletMax ?? 999)),
      );
    if (over) mark(true);
    next.items = next.items
      .slice(0, b.itemBulletCount ?? next.items.length)
      .map((item) => {
        const it = { ...item };
        if (it.title) it.title = truncate(it.title, 12);
        if (it.bullets) {
          let bs = it.bullets;
          if (b.itemBulletCount) bs = bs.slice(0, b.itemBulletCount);
          it.bullets = bs.map((t) => truncate(t, b.itemBulletMax ?? 999));
        }
        return it;
      });
  }

  if (next.chart?.data && next.chart.data.length > 8) {
    mark(next.chart.data.length > 8);
    next.chart = { ...next.chart, data: next.chart.data.slice(0, 8) };
  }

  if (next.metric && b.metricMax) {
    const full = `${next.metric.value}${next.metric.unit ?? ""}`;
    if (full.length > b.metricMax) {
      mark(true);
      next.metric = {
        ...next.metric,
        value: truncate(next.metric.value, b.metricMax),
      };
    }
  }

  if (next.quote && b.quoteMax && next.quote.length > b.quoteMax) {
    mark(true);
    next.quote = truncate(next.quote, b.quoteMax);
  }

  if (next.items && b.timelineNodeMax && slide.layout === "timeline") {
    if (next.items.length > b.timelineNodeMax) {
      mark(true);
      next.items = next.items.slice(0, b.timelineNodeMax);
    }
    const over = next.items.some(
      (it) =>
        (it.body ?? it.bullets?.join("；") ?? "").length >
        (b.timelineNodeTextMax ?? 999),
    );
    if (over) mark(true);
  }

  return { slide: next, truncated };
}
