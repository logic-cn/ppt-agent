// PDF 导入测试：mock pdfjs-dist，验证行聚合/标题启发式/章节切分
import { describe, it, expect, vi, beforeEach } from "vitest";
import { importPdf, linesToSections } from "./pdf";

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));

import { getDocument } from "pdfjs-dist";

/** 构造 pdfjs text item：transform = [size, 0, 0, size, x, baselineY] */
function item(str: string, size: number, y: number, x = 0) {
  return { str, transform: [size, 0, 0, size, x, y] };
}

function mockPdf(pages: { items: ReturnType<typeof item>[] }[], title = "") {
  vi.mocked(getDocument).mockReturnValue({
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: async (n: number) => ({
        getTextContent: async () => ({ items: pages[n - 1].items }),
      }),
      getMetadata: async () => ({ info: { Title: title } }),
    }),
  } as never);
}

function pdfFile(): File {
  return new File([new ArrayBuffer(8)], "report.pdf", {
    type: "application/pdf",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importPdf", () => {
  it("按字号启发式切分章节：大字号行为标题", async () => {
    mockPdf([
      {
        items: [
          item("季度经营报告", 24, 700, 40),
          item("本季度收入 970 万元，同比增长 18%。", 12, 660, 40),
          item("费用结构保持稳定，研发投入持续加大。", 12, 640, 40),
          item("现金流状况良好，经营质量稳步提升。", 12, 620, 40),
          item("市场规模与增速", 20, 600, 40),
          item("近三年 CAGR 为 18%。", 12, 560, 40),
          item("政策与需求双轮驱动行业扩容。", 12, 540, 40),
          item("头部厂商份额进一步集中。", 12, 520, 40),
        ],
      },
    ]);
    const result = await importPdf(pdfFile());
    expect(result.structured.sections).toEqual([
      {
        heading: "季度经营报告",
        content:
          "本季度收入 970 万元，同比增长 18%。\n费用结构保持稳定，研发投入持续加大。\n现金流状况良好，经营质量稳步提升。",
      },
      {
        heading: "市场规模与增速",
        content:
          "近三年 CAGR 为 18%。\n政策与需求双轮驱动行业扩容。\n头部厂商份额进一步集中。",
      },
    ]);
    expect(result.text).toContain("970 万元");
  });

  it("同行 text item 聚合为一行（按基线 y）", async () => {
    mockPdf([
      {
        items: [item("收入 ", 12, 660, 40), item("970 万元", 12, 660, 80)],
      },
    ]);
    const result = await importPdf(pdfFile());
    expect(result.text).toContain("收入 970 万元");
  });

  it("多页顺序拼接，rawText 保留页间顺序", async () => {
    mockPdf([
      { items: [item("第一页", 12, 700)] },
      { items: [item("第二页", 12, 700)] },
    ]);
    const result = await importPdf(pdfFile());
    expect(result.text.indexOf("第一页")).toBeLessThan(
      result.text.indexOf("第二页"),
    );
  });

  it("空 PDF（无文本层）给出警告且不崩溃", async () => {
    mockPdf([{ items: [] }]);
    const result = await importPdf(pdfFile());
    expect(result.text).toBe("");
    expect(result.structured.sections).toHaveLength(0);
  });
});

describe("linesToSections", () => {
  it("中位数启发式：正文为主的文档小标题也识别", () => {
    const lines = [
      { text: "引言", size: 14, page: 1 },
      { text: "正文A", size: 11, page: 1 },
      { text: "正文B", size: 11, page: 1 },
      { text: "正文C", size: 11, page: 1 },
      { text: "结论", size: 14, page: 1 },
      { text: "正文D", size: 11, page: 1 },
    ];
    const sections = linesToSections(lines, 11);
    expect(sections.map((s) => s.heading)).toEqual(["引言", "结论"]);
    expect(sections[0].content).toContain("正文C");
  });
});
