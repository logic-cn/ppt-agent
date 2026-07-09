import { z } from "zod/v4";
import { chat } from "./llm";
import {
  buildContentSystemPrompt,
  buildContentUserPrompt,
} from "./llm/prompts/content";
import type { BulletNode, ChartSpec } from "@/types/deck";
import { nanoid } from "nanoid";

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
  try {
    parsed = JSON.parse(res.content);
  } catch {
    const match = res.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1]);
    } else {
      return { body: res.content };
    }
  }

  const result = contentSchema.safeParse(parsed);
  if (!result.success) {
    return { body: res.content };
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
