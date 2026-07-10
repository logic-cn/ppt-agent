import { describe, it, expect } from "vitest";
import {
  parseDocument,
  chunkDocument,
  buildDocumentSummary,
  getDocumentStrategy,
} from "@/services/importer/pipeline";
import type { ImportInput } from "@/services/importer/types";

function makeInput(overrides?: Partial<ImportInput>): ImportInput {
  return {
    type: "text",
    title: "测试文档",
    ref: "test",
    rawText: "内容内容",
    sections: [
      { heading: "概述", content: "这是概述部分", level: 1 },
      { heading: "详情", content: "这是详情部分", level: 1 },
    ],
    ...overrides,
  };
}

describe("parseDocument", () => {
  it("从输入创建 ParsedDocument", () => {
    const doc = parseDocument(makeInput());
    expect(doc.source.title).toBe("测试文档");
    expect(doc.source.type).toBe("text");
    expect(doc.sections).toHaveLength(2);
    expect(doc.warnings).toHaveLength(0);
  });

  it("无章节时给出 warning", () => {
    const doc = parseDocument(makeInput({ sections: [] }));
    expect(doc.warnings.length).toBeGreaterThan(0);
  });

  it("每节自动生成 id", () => {
    const doc = parseDocument(makeInput());
    for (const section of doc.sections) {
      expect(section.id).toBeTruthy();
    }
  });
});

describe("chunkDocument", () => {
  it("短章节不分块", () => {
    const doc = parseDocument(makeInput({ sections: [{ heading: "短节", content: "短内容", level: 1 }] }));
    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("短内容");
  });

  it("长章节被分块", () => {
    const longContent = "段落\n".repeat(2000);
    const doc = parseDocument(makeInput({ sections: [{ heading: "长节", content: longContent, level: 1 }] }));
    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("每块有 tokenEstimate", () => {
    const doc = parseDocument(makeInput());
    const chunks = chunkDocument(doc);
    for (const chunk of chunks) {
      expect(chunk.tokenEstimate).toBeGreaterThan(0);
    }
  });
});

describe("getDocumentStrategy", () => {
  it("短文档返回 direct", () => {
    const doc = parseDocument(makeInput({ rawText: "短文本" }));
    expect(getDocumentStrategy(doc)).toBe("direct");
  });

  it("中等长度文档返回 chunk_summary", () => {
    const doc = parseDocument(makeInput({ rawText: "x".repeat(10000) }));
    expect(getDocumentStrategy(doc)).toBe("chunk_summary");
  });

  it("超长文档返回 select_sections", () => {
    const doc = parseDocument(makeInput({ rawText: "x".repeat(35000) }));
    expect(getDocumentStrategy(doc)).toBe("select_sections");
  });
});

describe("buildDocumentSummary", () => {
  it("生成可读摘要", () => {
    const doc = parseDocument(makeInput());
    const chunks = chunkDocument(doc);
    const summary = buildDocumentSummary(doc, chunks);
    expect(summary).toContain("测试文档");
    expect(summary).toContain("章节数");
    expect(summary).toContain("总字数");
  });
});
