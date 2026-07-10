import { z } from "zod/v4";
import { chat } from "./llm";
import {
  buildContentSystemPrompt,
  buildContentUserPrompt,
} from "./llm/prompts/content";
import type { BulletNode, ChartSpec, Deck, Slide } from "@/types/deck";
import { nanoid } from "nanoid";

/** 根据 Deck 与当前页构建传给 LLM 的上下文（其他页面标题 + 主题） */
export function buildContentContext(deck: Deck, slide: Slide): string {
  const otherTitles = deck.slides
    .filter((s) => s.id !== slide.id)
    .map((s, i) => `${i + 1}. ${s.title}`)
    .join("；");
  return `演示主题：${deck.title}。其他页面：${otherTitles || "（无）"}`;
}

const contentSchema = z.object({
  body: z.string().optional(),
  bullets: z
    .array(
      z.object({
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
      }),
    )
    .optional(),
  chart: z
    .object({
      type: z.enum(["bar", "pie", "line", "doughnut"]),
      title: z.string().optional(),
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    })
    .optional(),
});

export async function generateSlideContent(params: {
  slideTitle: string;
  context: string;
  signal?: AbortSignal;
}): Promise<{ body?: string; bullets?: BulletNode[]; chart?: ChartSpec }> {
  const systemPrompt = buildContentSystemPrompt();
  const userPrompt = buildContentUserPrompt(params.slideTitle, params.context);

  const res = await chat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    responseFormat: "json",
    signal: params.signal,
  });

  let parsed: unknown;
  let isStructured = false;
  try {
    parsed = JSON.parse(res.content);
    isStructured = true;
  } catch {
    const match = res.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
        isStructured = true;
      } catch {
        // 代码块内仍不是合法 JSON：原始输出不可作为正文，直接报错
        throw new Error("模型返回内容无法解析，请重试");
      }
    }
    // 无 JSON、无代码块：视为模型直接返回的纯文本正文（下方兜底）
  }

  // 纯文本兜底：模型未按 JSON 返回，但内容本身是可用正文
  if (!isStructured) {
    return { body: res.content };
  }

  const result = contentSchema.safeParse(parsed);
  if (!result.success) {
    // 结构不符合预期（如字段缺失/类型错误）：不可把原始输出写进正文
    throw new Error("模型返回内容不符合预期结构，无法生成，请重试");
  }

  const addIds = (
    nodes: {
      text: string;
      level: number;
      children?: { text: string; level: number }[];
    }[],
  ): BulletNode[] =>
    nodes.map((n) => ({
      id: nanoid(),
      text: n.text,
      level: n.level as 0 | 1 | 2,
      children: n.children?.map((c) => ({
        id: nanoid(),
        text: c.text,
        level: c.level as 1 | 2,
      })),
    }));

  return {
    body: result.data.body,
    bullets: result.data.bullets ? addIds(result.data.bullets) : undefined,
    chart: result.data.chart,
  };
}
