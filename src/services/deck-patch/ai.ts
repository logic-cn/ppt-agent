import type { Deck, SlideLayout } from "@/types/deck";
import type { DeckPatch } from "./types";
import { z } from "zod/v4";
import { deckPatchesResponseSchema } from "./schema";
import { chat } from "@/services/llm";
import {
  buildDeckPatchSystemPrompt,
  buildDeckPatchUserPrompt,
} from "./prompts";

// 本地模型走 grammar 约束解码（op 枚举由语法保证）；远程忽略该字段
const deckPatchesJsonSchema: unknown = z.toJSONSchema(
  deckPatchesResponseSchema,
);

const OPS =
  "set_deck_title | insert_slide | delete_slide | move_slide | update_slide | replace_slide | split_slide | merge_slides";

function parsePatchJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error("AI 返回的 JSON 无法解析");
  }
}

// zod 原始报错冗长，压缩为前几条「路径: 原因」便于回喂模型与展示
function summarizeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("；");
}

export interface DeckContextSummary {
  title: string;
  palette: string;
  slides: Array<{
    id: string;
    index: number;
    layout: SlideLayout;
    title: string;
    bulletTexts: string[];
    hasChart: boolean;
    hasImage: boolean;
  }>;
}

export function buildDeckContextSummary(deck: Deck): DeckContextSummary {
  return {
    title: deck.title,
    palette: deck.design.palette,
    slides: deck.slides.map((slide, index) => ({
      id: slide.id,
      index,
      layout: slide.layout,
      title: slide.title,
      bulletTexts: slide.bullets?.map((b) => b.text) ?? [],
      hasChart: !!slide.chart,
      hasImage: !!slide.image,
    })),
  };
}

export async function generateDeckPatches(params: {
  deck: Deck;
  userRequest: string;
  selectedSlideId?: string;
  conversationContext?: string;
  signal?: AbortSignal;
}): Promise<DeckPatch[]> {
  const context = buildDeckContextSummary(params.deck);

  const systemPrompt = buildDeckPatchSystemPrompt();
  const userPrompt = buildDeckPatchUserPrompt({
    userRequest: params.userRequest,
    context,
    selectedSlideId: params.selectedSlideId,
    conversationContext: params.conversationContext,
  });

  const rawGenerate = async (extra: string): Promise<string> => {
    const res = await chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt + extra },
      ],
      temperature: 0.4,
      maxTokens: 4000,
      responseFormat: "json",
      jsonSchema: deckPatchesJsonSchema,
      signal: params.signal,
    });
    return res.content;
  };

  // 小模型常把 op 写成非法别名（如 "update"），校验失败时带错误摘要重试
  let feedback = "";
  let lastError = "";
  for (let attempt = 0; attempt <= 2; attempt++) {
    const content = await rawGenerate(feedback);
    let parsed: unknown;
    try {
      parsed = parsePatchJson(content);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      feedback = `\n\n你上一次的输出不是合法 JSON（${lastError}）。请仅输出符合格式的完整 JSON，不要任何解释或代码块包裹。`;
      continue;
    }
    const result = deckPatchesResponseSchema.safeParse(parsed);
    if (result.success) return result.data.patches;
    lastError = summarizeIssues(result.error);
    feedback = `\n\n你上一次的输出存在以下格式错误：${lastError}\n其中 op 只能取：${OPS}。请修正后仅输出完整的 JSON，不要任何解释。`;
  }
  throw new Error(`AI 生成的修改方案格式不正确（已重试）：${lastError}`);
}
