import { describe, it, expect, vi } from "vitest";
import type PptxGenJS from "pptxgenjs";
import { translateSvgToSlide } from "./elements";
import { svgToPptx } from "./index";
import { DEFAULT_DESIGN } from "@/types/design";
import type { Slide } from "@/types/deck";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect x="100" y="50" width="300" height="120" rx="8" fill="#1A56DB"/>
  <text x="120" y="100" font-size="32" fill="#FFFFFF" text-anchor="start" font-family="sans-serif">Hello SVG</text>
</svg>`;

interface MockCall {
  kind: string;
  args: unknown[];
}
type MockSlide = PptxGenJS.Slide & { _calls: MockCall[] };

function createMockSlide(): MockSlide {
  const calls: MockCall[] = [];
  const slide = {
    addShape: vi.fn((...args: unknown[]) =>
      calls.push({ kind: "shape", args }),
    ),
    addText: vi.fn((...args: unknown[]) => calls.push({ kind: "text", args })),
    _calls: calls,
  } as unknown as MockSlide;
  return slide;
}

describe("translateSvgToSlide", () => {
  it("rect 经坐标换算后调用 addShape", () => {
    const slide = createMockSlide();
    translateSvgToSlide(SAMPLE_SVG, slide);

    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    expect(shapeCall).toBeDefined();
    const [type, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number; w: number; h: number; rectRadius?: number },
    ];
    expect(type).toBe("roundRect");
    // 100/1280*13.333 ≈ 1.0416; 50/720*7.5 ≈ 0.5208
    expect(opts.x).toBeCloseTo(1.0416, 3);
    expect(opts.y).toBeCloseTo(0.5208, 3);
    expect(opts.w).toBeCloseTo(3.1249, 3);
    expect(opts.h).toBeCloseTo(1.25, 3);
    expect(opts.rectRadius).toBeCloseTo(0.0833, 3);
  });

  it("text 经坐标换算后调用 addText", () => {
    const slide = createMockSlide();
    translateSvgToSlide(SAMPLE_SVG, slide);

    const textCall = slide._calls.find((c) => c.kind === "text");
    expect(textCall).toBeDefined();
    const [text, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number; fontSize: number; color: string; align: string },
    ];
    expect(text).toBe("Hello SVG");
    expect(opts.x).toBeCloseTo(1.25, 3);
    expect(opts.fontSize).toBe(32);
    expect(opts.color).toBe("FFFFFF");
    expect(opts.align).toBe("left");
  });
});

describe("svgToPptx", () => {
  it("返回非空 Blob", async () => {
    const slides: Slide[] = [
      { id: "s1", layout: "content", title: "t", svg: SAMPLE_SVG },
      { id: "s2", layout: "content", title: "no-svg" },
    ];
    const blob = await svgToPptx(slides, DEFAULT_DESIGN);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
