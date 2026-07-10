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
import type { Slide, SlideSourceRef } from "@/types/deck";
import { generateOutline } from "@/services/outline";

const CHUNK_MAX_CHARS = 3000;
const LONG_DOC_THRESHOLD = 8000;
const VERY_LONG_DOC_THRESHOLD = 30000;

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
  const numberPattern = /([\d,]+(?:\.\d+)?)\s*(%|亿|万|千|元|美元|欧元|年|月|日|人|个|家|例)?/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = numberPattern.exec(text)) !== null) {
    const valueStr = match[1].replace(/,/g, "");
    const value = parseFloat(valueStr);
    if (isNaN(value) || value === 0) continue;

    const contextStart = Math.max(0, match.index - 20);
    const contextEnd = Math.min(text.length, match.index + match[0].length + 30);
    const context = text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();
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
  const docContent = context.chunks
    .map((c) => c.summary || c.text)
    .join("\n\n");

  const slides = await generateOutline({
    topic: context.source.title,
    docContent: docContent.slice(0, 12000),
    pageCount: options?.pageCount,
    signal: options?.signal,
  });

  const slidesWithRefs: Slide[] = slides.map((slide) => {
    const quote = slide.bullets?.length
      ? slide.bullets.map((b) => b.text).join(" ")
      : slide.title;
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

function findMatchingChunk(
  chunks: DocumentChunk[],
  text: string,
): DocumentChunk | undefined {
  const keywords = text
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.toLowerCase());

  let best: DocumentChunk | undefined;
  let bestScore = 0;

  for (const chunk of chunks) {
    const chunkLower = chunk.text.toLowerCase();
    const score = keywords.filter((kw) => chunkLower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = chunk;
    }
  }

  return best && bestScore > 0 ? best : undefined;
}
