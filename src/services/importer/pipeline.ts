import { nanoid } from "nanoid";
import type {
  DocumentSource,
  DocumentSection,
  DocumentChunk,
  ParsedDocument,
  DocumentOutlineContext,
  ImportInput,
  DocumentPrepareOptions,
  KeyFact,
} from "./types";
import type { Slide, SlideSourceRef, Deck } from "@/types/deck";
import { DEFAULT_DESIGN } from "@/types/design";
import { buildDeckSvgs } from "@/engine/svg/pipeline";
import { extractSvgTexts } from "@/engine/svg/quality/checker";
import { chat } from "@/services/llm";

const CHUNK_MAX_CHARS = 3000;
const LONG_DOC_THRESHOLD = 8000;
const VERY_LONG_DOC_THRESHOLD = 30000;
/** 分块摘要触发阈值：超过该字数的文档先做逐块摘要，避免把全文塞给 LLM */
const SUMMARY_TRIGGER_CHARS = 8000;
/** 每次摘要请求最多拼接的片段字数 */
const SUMMARY_BATCH_CHARS = 6000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function parseDocument(input: ImportInput): ParsedDocument {
  const source: DocumentSource = {
    id: nanoid(),
    type: input.type,
    title: input.title,
    ref: input.ref,
    importedAt: Date.now(),
  };

  const sections: DocumentSection[] = input.sections.map((s, i) => ({
    id: nanoid(),
    heading: s.heading,
    level: s.level ?? 1,
    content: s.content,
    order: i,
  }));

  const warnings: string[] = [];
  if (sections.length === 0) {
    warnings.push("未能识别章节结构");
  }

  return { source, sections, rawText: input.rawText, warnings };
}

export function chunkDocument(doc: ParsedDocument): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  for (const section of doc.sections) {
    const text = section.content;
    if (!text.trim()) continue;

    if (text.length <= CHUNK_MAX_CHARS) {
      chunks.push({
        id: nanoid(),
        sectionId: section.id,
        text,
        tokenEstimate: estimateTokens(text),
      });
    } else {
      const parts = splitIntoChunks(text, CHUNK_MAX_CHARS);
      for (const part of parts) {
        chunks.push({
          id: nanoid(),
          sectionId: section.id,
          text: part,
          tokenEstimate: estimateTokens(part),
        });
      }
    }
  }

  return chunks;
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      const breakAt = text.lastIndexOf("\n", end);
      if (breakAt > start) end = breakAt;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks;
}

export function buildDocumentSummary(
  doc: ParsedDocument,
  chunks: DocumentChunk[],
): string {
  const parts: string[] = [];
  parts.push(`文档标题：${doc.source.title}`);
  parts.push(`章节数：${doc.sections.length}`);
  parts.push(`总字数：${doc.rawText.length}`);
  parts.push(`分块数：${chunks.length}`);

  const overview = doc.sections
    .slice(0, 10)
    .map((s) => `${s.heading}（${s.content.length}字）`)
    .join("、");
  parts.push(`章节概览：${overview}`);

  if (doc.sections.length > 10) {
    parts.push(`...及其他 ${doc.sections.length - 10} 个章节`);
  }

  return parts.join("\n");
}

export function getDocumentStrategy(
  doc: ParsedDocument,
): "direct" | "chunk_summary" | "select_sections" {
  const len = doc.rawText.length;
  if (len < LONG_DOC_THRESHOLD) return "direct";
  if (len < VERY_LONG_DOC_THRESHOLD) return "chunk_summary";
  return "select_sections";
}

const SUMMARY_SYSTEM_PROMPT =
  "你是文档摘要助手。用户会给出若干文档片段，按顺序编号。" +
  "请为每个片段生成一句简洁的中文摘要（不超过 60 字），保留关键数字、结论和专有名词。" +
  "严格按如下格式输出，每行一个，不要输出额外说明：\n" +
  "1. 摘要\n2. 摘要\n3. 摘要";

function batchChunks(
  chunks: DocumentChunk[],
  maxChars: number,
): DocumentChunk[][] {
  const batches: DocumentChunk[][] = [];
  let current: DocumentChunk[] = [];
  let currentChars = 0;
  for (const chunk of chunks) {
    if (currentChars + chunk.text.length > maxChars && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(chunk);
    currentChars += chunk.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function parseNumberedSummaries(text: string, count: number): string[] {
  const summaries: string[] = new Array(count).fill("");
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\s*[.、)]\s*(.+)$/.exec(line);
    if (!m) continue;
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < count) summaries[idx] = m[2].trim();
  }
  return summaries;
}

async function summarizeBatch(
  batch: DocumentChunk[],
  signal?: AbortSignal,
): Promise<DocumentChunk[]> {
  const userContent = batch
    .map((c, i) => `片段${i + 1}:\n${c.text.slice(0, 3000)}`)
    .join("\n\n");

  try {
    const res = await chat({
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      signal,
    });
    const summaries = parseNumberedSummaries(res.content, batch.length);
    return batch.map((c, i) => ({
      ...c,
      summary: summaries[i] || undefined,
    }));
  } catch {
    // 摘要失败不阻断导入，退化为使用原文
    return batch;
  }
}

/**
 * 为文档片段生成逐块摘要（chunk_summary 策略的核心）。
 * 已含摘要的片段直接返回；其余按字数分批调用 LLM 摘要。
 * 任意片段摘要失败都退化为原文，不抛错。
 */
export async function summarizeChunks(
  chunks: DocumentChunk[],
  opts?: { signal?: AbortSignal },
): Promise<DocumentChunk[]> {
  if (chunks.length === 0) return chunks;
  if (chunks.every((c) => c.summary)) return chunks;

  const batches = batchChunks(chunks, SUMMARY_BATCH_CHARS);
  // 并发限流：Promise.all 全量并发会在长文档时瞬间打出大量请求，
  // 触发 provider 限流；按 3 并发滚动执行，单批失败仍退化为原文不抛错
  const summarized: DocumentChunk[][] = new Array(batches.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(3, batches.length) },
    async () => {
      while (next < batches.length) {
        const index = next++;
        summarized[index] = await summarizeBatch(batches[index], opts?.signal);
      }
    },
  );
  await Promise.all(workers);
  return summarized.flat();
}

export async function prepareDocumentForOutline(
  doc: ParsedDocument,
  _options?: DocumentPrepareOptions,
): Promise<DocumentOutlineContext> {
  const chunks = chunkDocument(doc);
  const summary = buildDocumentSummary(doc, chunks);

  const allKeyFacts: KeyFact[] = [];
  for (const chunk of chunks) {
    const facts = extractKeyFacts(chunk.text, chunk.id);
    allKeyFacts.push(...facts);
  }

  return {
    source: doc.source,
    selectedSectionIds: doc.sections.map((s) => s.id),
    chunks,
    summary,
    keyFacts: allKeyFacts,
  };
}

function extractKeyFacts(text: string, chunkId: string): KeyFact[] {
  const facts: KeyFact[] = [];
  const numberPattern =
    /([\d,]+(?:\.\d+)?)\s*(%|亿|万|千|元|美元|欧元|年|月|日|人|个|家|例)?/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = numberPattern.exec(text)) !== null) {
    const valueStr = match[1].replace(/,/g, "");
    const value = parseFloat(valueStr);
    if (isNaN(value) || value === 0) continue;

    const contextStart = Math.max(0, match.index - 20);
    const contextEnd = Math.min(
      text.length,
      match.index + match[0].length + 30,
    );
    const context = text
      .slice(contextStart, contextEnd)
      .replace(/\s+/g, " ")
      .trim();
    if (seen.has(context)) continue;
    seen.add(context);

    facts.push({
      id: nanoid(),
      text: context,
      value,
      unit: match[2] || undefined,
      sourceChunkId: chunkId,
    });
  }

  return facts.slice(0, 5);
}

export async function generateOutlineFromDocument(
  context: DocumentOutlineContext,
  options?: { pageCount?: number; signal?: AbortSignal },
): Promise<Slide[]> {
  // 仅使用用户勾选的章节对应的片段（select_sections 策略生效点）
  const selectedIds = new Set(context.selectedSectionIds);
  let chunks = context.chunks.filter((c) => selectedIds.has(c.sectionId));

  // 长文档走分块摘要，避免把全文一次性塞给 LLM（chunk_summary 策略生效点）
  const totalChars = chunks.reduce((n, c) => n + c.text.length, 0);
  if (totalChars > SUMMARY_TRIGGER_CHARS) {
    chunks = await summarizeChunks(chunks, { signal: options?.signal });
  }

  const docContent = chunks.map((c) => c.summary || c.text).join("\n\n");

  // X1 管线：用 buildDeckSvgs 生成 svg 设计真相（先构造一个空 deck 供其对齐页数与 title）
  const baseDeck: Deck = {
    id: nanoid(),
    title: context.source.title,
    design: DEFAULT_DESIGN,
    slides: [],
    version: 2,
    createdAt: 0,
    updatedAt: 0,
  };
  const newDeck = await buildDeckSvgs(baseDeck, DEFAULT_DESIGN, {
    topic: context.source.title,
    docContent: docContent.slice(0, 12000),
    pageCount: options?.pageCount,
    signal: options?.signal,
  });

  const slides = newDeck.slides;

  const slidesWithRefs: Slide[] = slides.map((slide) => {
    const quote = slideMatchText(slide);
    const matchedChunk = findMatchingChunk(context.chunks, quote);
    const refs: SlideSourceRef[] = matchedChunk
      ? [
          {
            sourceId: context.source.id,
            sectionId: matchedChunk.sectionId,
            chunkId: matchedChunk.id,
            quote: quote.slice(0, 100),
          },
        ]
      : [];

    return { ...slide, sourceRefs: refs };
  });

  return slidesWithRefs;
}

/**
 * 参与来源匹配的页面文本：标题 + 要点 + SVG 里实际渲染的文字。
 *
 * X1 管线产出的页面要点常为空（内容在 SVG 里），只取 bullets 会退化成
 * 「按标题逐字匹配」，中文释义标题几乎必然匹配不上。
 */
function slideMatchText(slide: Slide): string {
  const parts: string[] = [];
  if (slide.title) parts.push(slide.title);
  if (slide.bullets?.length) parts.push(...slide.bullets.map((b) => b.text));
  if (slide.svg) parts.push(...extractSvgTexts(slide.svg));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 抽取匹配关键词：ASCII 单词 + 中文二元组。
 *
 * 中文没有空格，按空白切词会把整句变成一个词，导致「释义标题」永远匹配不上；
 * 二元组（行业/市场/规模）粒度足够细，又能容忍同义改写。
 */
function extractMatchKeywords(text: string): string[] {
  const keywords = new Set<string>();

  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3) keywords.add(w);
  }

  for (const run of text.replace(/[^一-龥]/g, " ").split(/\s+/)) {
    if (!run) continue;
    if (run.length === 1) {
      keywords.add(run);
      continue;
    }
    for (let i = 0; i + 1 < run.length; i++) keywords.add(run.slice(i, i + 2));
  }

  return [...keywords];
}

function findMatchingChunk(
  chunks: DocumentChunk[],
  text: string,
): DocumentChunk | undefined {
  const keywords = extractMatchKeywords(text);
  if (keywords.length === 0) return undefined;

  let best: DocumentChunk | undefined;
  let bestHits = 0;

  for (const chunk of chunks) {
    const haystack = chunk.text.toLowerCase();
    let hits = 0;
    for (const kw of keywords) {
      if (haystack.includes(kw)) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = chunk;
    }
  }

  // 关键词多时要求至少命中 2 个，避免单个常见二元组造成误匹配
  const threshold = keywords.length <= 2 ? 1 : 2;
  return bestHits >= threshold ? best : undefined;
}
