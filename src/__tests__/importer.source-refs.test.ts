import { describe, it, expect, vi, beforeEach } from "vitest";

// 真实 LLM 与 X1 生成管线都不参与：这里只验证「生成结果 → sourceRefs」的匹配逻辑
vi.mock("@/services/llm", () => ({ chat: vi.fn() }));

const { buildDeckSvgs } = vi.hoisted(() => ({ buildDeckSvgs: vi.fn() }));
vi.mock("@/engine/svg/pipeline", () => ({ buildDeckSvgs }));

import { generateOutlineFromDocument } from "@/services/importer/pipeline";
import type { DocumentOutlineContext } from "@/services/importer/types";

function makeContext(): DocumentOutlineContext {
  return {
    source: {
      id: "src-1",
      type: "text",
      title: "行业报告",
      ref: "doc.md",
      importedAt: 0,
    },
    selectedSectionIds: ["sec-1"],
    chunks: [
      {
        id: "chunk-market",
        sectionId: "sec-1",
        text: "2024 年全球市场规模达到 5 千亿美元，行业竞争格局加速重构，机会窗口显现。",
        tokenEstimate: 30,
      },
      {
        id: "chunk-org",
        sectionId: "sec-1",
        text: "公司组织架构调整与人才梯队建设是下一阶段重点。",
        tokenEstimate: 20,
      },
    ],
    summary: "",
    keyFacts: [],
  };
}

/** 模拟 X1 管线产出：标题为释义式中文，SVG 正文带真实数据，bullets 为空 */
function mockPipeline(slides: unknown[]) {
  buildDeckSvgs.mockResolvedValue({
    id: "deck-1",
    title: "行业报告",
    design: {},
    slides,
    version: 2,
    createdAt: 0,
    updatedAt: 0,
  });
}

describe("generateOutlineFromDocument · sourceRefs 匹配", () => {
  beforeEach(() => {
    buildDeckSvgs.mockReset();
  });

  it("中文释义标题也能匹配到来源 chunk（不要求原文逐字出现）", async () => {
    mockPipeline([
      {
        id: "s1",
        layout: "content",
        title: "行业机会与竞争格局",
        svg: `<svg viewBox="0 0 1280 720"><text x="40" y="80">行业机会与竞争格局</text></svg>`,
      },
    ]);

    const slides = await generateOutlineFromDocument(makeContext());
    const refs = slides[0].sourceRefs ?? [];

    expect(refs).toHaveLength(1);
    expect(refs[0].chunkId).toBe("chunk-market");
    expect(refs[0].sourceId).toBe("src-1");
    expect(refs[0].sectionId).toBe("sec-1");
  });

  it("匹配用文本取自 SVG 实际渲染内容，而非空 bullets", async () => {
    mockPipeline([
      {
        id: "s1",
        layout: "content",
        title: "市场规模",
        bullets: [],
        svg: `<svg viewBox="0 0 1280 720"><text x="40" y="80">市场规模</text><text x="40" y="140">增速 30%</text></svg>`,
      },
    ]);

    const slides = await generateOutlineFromDocument(makeContext());
    const refs = slides[0].sourceRefs ?? [];

    expect(refs).toHaveLength(1);
    // 引文应包含 SVG 正文里的数据片段，页面上可追溯
    expect(refs[0].quote).toContain("增速");
  });

  it("与来源完全无关的页面不硬塞空引用", async () => {
    mockPipeline([
      {
        id: "s1",
        layout: "content",
        title: "异想天开",
        svg: `<svg viewBox="0 0 1280 720"><text x="40" y="80">异想天开</text></svg>`,
      },
    ]);

    const slides = await generateOutlineFromDocument(makeContext());
    expect(slides[0].sourceRefs ?? []).toHaveLength(0);
  });
});

describe("generateOutlineFromDocument · 脚手架 deck id", () => {
  beforeEach(() => {
    buildDeckSvgs.mockReset();
  });

  it("不再使用硬编码的 import-temp 作为 deck id", async () => {
    mockPipeline([{ id: "s1", layout: "cover", title: "封面" }]);

    await generateOutlineFromDocument(makeContext());
    const deckArg = buildDeckSvgs.mock.calls[0]![0] as { id: string };

    expect(deckArg.id).toBeTruthy();
    expect(deckArg.id).not.toBe("import-temp");
  });

  it("两次生成使用不同 id（不会互相覆盖）", async () => {
    mockPipeline([{ id: "s1", layout: "cover", title: "封面" }]);

    await generateOutlineFromDocument(makeContext());
    await generateOutlineFromDocument(makeContext());
    const first = buildDeckSvgs.mock.calls[0]![0] as { id: string };
    const second = buildDeckSvgs.mock.calls[1]![0] as { id: string };

    expect(first.id).not.toBe(second.id);
  });
});
