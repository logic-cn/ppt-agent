import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock LLM 与 X1 生成管线，避免真实网络与 LLM 调用
vi.mock("@/services/llm", () => ({ chat: vi.fn() }));
vi.mock("@/engine/svg/pipeline", () => ({
  buildDeckSvgs: vi.fn().mockResolvedValue({
    id: "import-temp",
    title: "测试文档",
    design: {},
    slides: [{ id: "s1", layout: "cover", title: "封面" }],
    version: 2,
    createdAt: 0,
    updatedAt: 0,
  }),
}));

import { chat } from "@/services/llm";
import { buildDeckSvgs } from "@/engine/svg/pipeline";
import {
  parseDocument,
  chunkDocument,
  summarizeChunks,
  generateOutlineFromDocument,
} from "@/services/importer/pipeline";
import type {
  ImportInput,
  DocumentOutlineContext,
} from "@/services/importer/types";

function makeInput(rawText: string): ImportInput {
  return {
    type: "text",
    title: "测试文档",
    ref: "test",
    rawText,
    sections: [
      { heading: "章节A", content: "片段一的内容详细描述", level: 1 },
      { heading: "章节B", content: "片段二的内容详细描述", level: 1 },
    ],
  };
}

function mockChatOnce(summaryText: string) {
  (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    content: summaryText,
  });
}

describe("summarizeChunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("为片段生成逐块摘要", async () => {
    const doc = parseDocument(makeInput("短"));
    const chunks = chunkDocument(doc);
    mockChatOnce("1. 摘要一\n2. 摘要二");

    const out = await summarizeChunks(chunks);
    expect(out[0].summary).toBe("摘要一");
    expect(out[1].summary).toBe("摘要二");
  });

  it("已含摘要的片段直接返回，不重复调用 LLM", async () => {
    const doc = parseDocument(makeInput("短"));
    const chunks = chunkDocument(doc).map((c, i) => ({
      ...c,
      summary: `已有${i}`,
    }));
    const out = await summarizeChunks(chunks);
    expect(chat).not.toHaveBeenCalled();
    expect(out[0].summary).toBe("已有0");
  });

  it("LLM 失败时退化为原文，不抛错", async () => {
    const doc = parseDocument(makeInput("短"));
    const chunks = chunkDocument(doc);
    (chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("网络错误"),
    );
    const out = await summarizeChunks(chunks);
    expect(out).toHaveLength(chunks.length);
    expect(out.every((c) => !c.summary)).toBe(true);
  });
});

describe("generateOutlineFromDocument 分块摘要与章节过滤", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("使用预填摘要而非原文作为生成内容", async () => {
    const doc = parseDocument(makeInput("短"));
    const chunks = chunkDocument(doc).map((c, i) => ({
      ...c,
      summary: `摘要${i}`,
    }));
    const ctx: DocumentOutlineContext = {
      source: doc.source,
      selectedSectionIds: doc.sections.map((s) => s.id),
      chunks,
      summary: "",
      keyFacts: [],
    };
    await generateOutlineFromDocument(ctx);
    const callArg = (buildDeckSvgs as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][2] as { docContent?: string };
    expect(callArg.docContent).toContain("摘要0");
    expect(callArg.docContent).toContain("摘要1");
    expect(callArg.docContent).not.toContain("片段一的内容");
  });

  it("仅使用用户勾选章节对应的片段", async () => {
    const doc = parseDocument(makeInput("短"));
    const chunks = chunkDocument(doc).map((c, i) => ({
      ...c,
      summary: `摘要${i}`,
    }));
    const ctx: DocumentOutlineContext = {
      source: doc.source,
      selectedSectionIds: [doc.sections[0].id],
      chunks,
      summary: "",
      keyFacts: [],
    };
    await generateOutlineFromDocument(ctx);
    const callArg = (buildDeckSvgs as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][2] as { docContent?: string };
    expect(callArg.docContent).toContain("摘要0");
    expect(callArg.docContent).not.toContain("摘要1");
  });

  it("长文档自动触发逐块摘要", async () => {
    // chunkDocument 基于章节内容切分，因此用长篇章节内容触发摘要
    const doc = parseDocument({
      type: "text",
      title: "长文档",
      ref: "r",
      rawText: "x".repeat(9000),
      sections: [
        { heading: "A", content: "章节一内容".repeat(1000), level: 1 },
        { heading: "B", content: "章节二内容".repeat(1000), level: 1 },
      ],
    });
    const chunks = chunkDocument(doc);
    // 持久 mock：返回足够多的编号摘要行，覆盖任意分批大小
    (chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: Array.from(
        { length: 10 },
        (_, i) => `${i + 1}. 长文档摘要${i}`,
      ).join("\n"),
    });
    const ctx: DocumentOutlineContext = {
      source: doc.source,
      selectedSectionIds: doc.sections.map((s) => s.id),
      chunks,
      summary: "",
      keyFacts: [],
    };
    await generateOutlineFromDocument(ctx);
    expect(chat).toHaveBeenCalled();
    const callArg = (buildDeckSvgs as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][2] as { docContent?: string };
    expect(callArg.docContent).toContain("长文档摘要0");
  });
});
