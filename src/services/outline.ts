import { z } from "zod/v4";
import { chat } from "./llm";
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
} from "./llm/prompts/outline";
import type { BulletNode, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildContextualPrompt, getTemplatePackById } from "@/templates";
import { selectFewShot, buildFewShotPrompt } from "./llm/few-shot";
import { nanoid } from "nanoid";

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
  layout: z.enum([
    "cover",
    "section",
    "content",
    "two-column",
    "chart",
    "image",
    "closing",
    "cols-2",
    "cols-3",
    "cols-4",
    "cols-5",
    "cols-6",
  ]),
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
});

/**
 * 生成 PPT 大纲。
 * 输入主题/文档 → LLM JSON mode → 校验 → 附加 id → 返回 Slide[]
 */
export async function generateOutline(params: {
  topic: string;
  design: DesignLock;
  audience?: string;
  pageCount?: number;
  docContent?: string;
  signal?: AbortSignal;
  contextualPrompt?: string;
}): Promise<Slide[]> {
  const design = params.design;
  const templateCtx =
    params.contextualPrompt ??
    (design.templateId
      ? buildContextualPrompt(
          getTemplatePackById(design.templateId)!,
          params.topic,
        )
      : undefined);
  const systemPrompt = buildOutlineSystemPrompt({
    design,
    templateCtx,
    fewShot: buildFewShotPrompt(selectFewShot(design)),
  });
  const userPrompt = buildOutlineUserPrompt(params);

  const res = await chat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    responseFormat: "json",
    signal: params.signal,
  });

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

  // 兼容 json_object 模式：将顶层对象中的幻灯片数组提取出来
  if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
    const arrayCandidate = Object.values(parsed).find(
      (v) =>
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === "object" &&
        v[0] !== null &&
        ("title" in v[0] || "layout" in v[0]),
    );
    if (arrayCandidate) {
      parsed = arrayCandidate;
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

  // 附加 id
  return validSlides.map((slide) => ({
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
