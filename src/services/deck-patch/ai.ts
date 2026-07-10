import type { Deck, SlideLayout } from "@/types/deck";
import type { DeckPatch } from "./types";
import { deckPatchesResponseSchema } from "./schema";
import { chat } from "@/services/llm";
import {
  buildDeckPatchSystemPrompt,
  buildDeckPatchUserPrompt,
} from "./prompts";

export interface DeckContextSummary {
  title: string;
  themeId: string;
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
    themeId: deck.themeId,
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

  const res = await chat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    responseFormat: "json",
    signal: params.signal,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.content);
  } catch {
    const match = res.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error("AI 返回的 JSON 无法解析");
      }
    } else {
      throw new Error("AI 返回的 JSON 无法解析");
    }
  }

  const result = deckPatchesResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Patch 格式校验失败：${result.error.message}`);
  }

  return result.data.patches;
}
