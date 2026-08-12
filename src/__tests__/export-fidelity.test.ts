import { describe, it, expect, vi } from "vitest";
import type PptxGenJS from "pptxgenjs";
import { translateSvgToSlide } from "@/engine/pptx-translator/elements";

// P1-4：预览 vs 导出像素级一致性回归（轻量元素级差分）。
// 把关点：导出结果的所有元素必须落在画布内（越界断言），
// 且 SVG 中声明的主要元素（形状/文本/路径/渐变/图表）都能在导出中找到对应。

const CANVAS = { w: 13.333, h: 7.5 };

const GOLDEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g1">
      <stop offset="0" stop-color="#1A56DB"/>
      <stop offset="1" stop-color="#7E22CE"/>
    </linearGradient>
    <radialGradient id="g2">
      <stop offset="0" stop-color="#FDE68A"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </radialGradient>
  </defs>
  <rect x="40" y="40" width="400" height="120" fill="url(#g1)"/>
  <rect x="40" y="200" width="300" height="90" fill="#FFFFFF" stroke="#1A56DB" stroke-width="4"/>
  <rect x="40" y="320" width="200" height="60" rx="12" fill="#0EA5E9"/>
  <g transform="translate(500, 300)">
    <circle cx="100" cy="80" r="60" fill="#10B981"/>
  </g>
  <path d="M 40 500 A 50 50 0 1 1 140 500 A 50 50 0 1 1 40 500" fill="url(#g2)"/>
  <text x="60" y="360" font-size="36" fill="#111827">主要标题示例</text>
  <text x="60" y="420" font-size="24" fill="#4B5563" opacity="0.8">副标题 secondary text</text>
  <line x1="60" y1="560" x2="1220" y2="560" stroke="#E5E7EB" stroke-width="2"/>
</svg>`;

interface ExportCall {
  kind: "shape" | "text" | "image" | "chart";
  type?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
}

type MockSlide = PptxGenJS.Slide & { _calls: ExportCall[] };

function translate(svg: string): ExportCall[] {
  const calls: ExportCall[] = [];
  const slide = {
    addShape: vi.fn((type: string, opts: { x: number; y: number; w: number; h: number }) =>
      calls.push({ kind: "shape", type, x: opts.x, y: opts.y, w: opts.w, h: opts.h }),
    ),
    addText: vi.fn((text: string, opts: { x: number; y: number; w: number; h: number }) =>
      calls.push({ kind: "text", text, x: opts.x, y: opts.y, w: opts.w, h: opts.h }),
    ),
    addChart: vi.fn((opts: { x: number; y: number; w: number; h: number }) =>
      calls.push({ kind: "chart", x: opts.x, y: opts.y, w: opts.w, h: opts.h }),
    ),
    addImage: vi.fn((opts: { x: number; y: number; w: number; h: number }) =>
      calls.push({ kind: "image", x: opts.x, y: opts.y, w: opts.w, h: opts.h }),
    ),
    addNotes: vi.fn(),
  } as unknown as MockSlide;
  translateSvgToSlide(svg, slide);
  return calls;
}

describe("P1-4 预览 vs 导出元素一致性（golden svg）", () => {
  it("全部导出元素不越界", () => {
    const calls = translate(GOLDEN_SVG);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.x).toBeGreaterThanOrEqual(-0.01);
      expect(c.y).toBeGreaterThanOrEqual(-0.01);
      expect(c.x + c.w).toBeLessThanOrEqual(CANVAS.w + 0.02);
      expect(c.y + c.h).toBeLessThanOrEqual(CANVAS.h + 0.02);
    }
  });

  it("主要元素覆盖：渐变分段、描边矩形、圆角矩形、圆、路径圆、文本、线", () => {
    const calls = translate(GOLDEN_SVG);
    // 渐变矩形切成 2 色块 + 描边矩形 = ≥3 个 rect
    expect(calls.filter((c) => c.kind === "shape" && c.type === "rect").length)
      .toBeGreaterThanOrEqual(3);
    // 圆角矩形（roundRect）
    expect(calls.some((c) => c.kind === "shape" && c.type === "roundRect")).toBe(true);
    // 圆 + 路径圆（都 → ellipse）
    expect(calls.filter((c) => c.kind === "shape" && c.type === "ellipse").length)
      .toBeGreaterThanOrEqual(2);
    // 线
    expect(calls.some((c) => c.kind === "shape" && c.type === "line")).toBe(true);
    // 两段文本都在
    const texts = calls.filter((c) => c.kind === "text").map((c) => c.text);
    expect(texts).toContain("主要标题示例");
    expect(texts).toContain("副标题 secondary text");
  });

  it("translate 位移后的元素位置与 SVG 语义一致", () => {
    const calls = translate(GOLDEN_SVG);
    // g translate(500,300) 内 circle cx=100 cy=80 r=60 → 中心 (600, 380)
    const ellipse = calls.find(
      (c) => c.kind === "shape" && c.type === "ellipse",
    )!;
    const cxInch = (ellipse.x + ellipse.w / 2) * (1280 / 13.333);
    const cyInch = (ellipse.y + ellipse.h / 2) * (720 / 7.5);
    expect(cxInch).toBeCloseTo(600, 0);
    expect(cyInch).toBeCloseTo(380, 0);
  });
});