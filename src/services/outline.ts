import { z } from "zod/v4";
import { chat } from "./llm";
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
} from "./llm/prompts/outline";
import type { BulletNode, Slide } from "@/types/deck";
import { nanoid } from "nanoid";

/** 递归为 bullet 节点添加 id */
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
    level: n.level as 0 | 1 | 2,
    children: n.children
      ? n.children.map((c) => ({
          id: nanoid(),
          text: c.text,
          level: c.level as 1 | 2,
        }))
      : undefined,
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
  ]),
  subtitle: z.string().optional(),
  bullets: z.array(bulletNodeSchema).optional(),
  chart: z
    .object({
      type: z.enum(["bar", "pie", "line", "doughnut"]),
      title: z.string().optional(),
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    })
    .optional(),
});

const outlineSchema = z.array(slideSchema);

/**
 * 生成 PPT 大纲。
 * 输入主题/文档 → LLM JSON mode → 校验 → 附加 id → 返回 Slide[]
 */
export async function generateOutline(params: {
  topic: string;
  audience?: string;
  pageCount?: number;
  docContent?: string;
  signal?: AbortSignal;
}): Promise<Slide[]> {
  const systemPrompt = buildOutlineSystemPrompt();
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

  // 兼容 json_object 模式：将顶层对象中的首个数组提取出来
  if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
    const arrayCandidate = Object.values(parsed).find(Array.isArray);
    if (arrayCandidate) {
      parsed = arrayCandidate;
    }
  }

  // Zod 校验
  const result = outlineSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `大纲格式校验失败：${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  // 附加 id
  return result.data.map((slide) => ({
    ...slide,
    id: nanoid(),
    bullets: slide.bullets ? addBulletIds(slide.bullets) : undefined,
  }));
}
