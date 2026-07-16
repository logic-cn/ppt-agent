import { describe, it, expect, vi } from "vitest";
import type PptxGenJS from "pptxgenjs";
import { translateSvgToSlide } from "./elements";
import { svgToPptx } from "./index";
import { collectDefs, resolveFill } from "./gradient";
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

  it("text 含 tspan 时不重复渲染 text 自身（addText 调用次数等于 tspan 数）", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="120" y="100" font-size="32" fill="#FFFFFF" font-family="sans-serif">
        <tspan x="120" y="100">子</tspan>
        <tspan x="160" y="100">段</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);

    const textCalls = slide._calls.filter((c) => c.kind === "text");
    expect(textCalls.length).toBe(2);
    const texts = textCalls.map((c) => (c.args as [string, unknown])[0]);
    expect(texts).toEqual(["子", "段"]);
  });
});

describe("渐变降级", () => {
  it("collectDefs 解析 linearGradient 的 stops", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="g">
          <stop offset="0" stop-color="#ff0000"/>
          <stop offset="1" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
    </svg>`;
    const defs = collectDefs(svg);
    expect(defs.g).toBeDefined();
    expect(defs.g.stops).toHaveLength(2);
    expect(defs.g.stops[0].color.toLowerCase()).toBe("ff0000");
    expect(defs.g.stops[1].color.toLowerCase()).toBe("0000ff");
  });

  it("resolveFill 将 linearGradient 降级为首末 stop 平均色", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="g">
          <stop offset="0" stop-color="#ff0000"/>
          <stop offset="1" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
    </svg>`;
    const defs = collectDefs(svg);
    const fill = resolveFill({ fill: "url(#g)" }, defs);
    expect(fill.color).toMatch(/^[0-9a-fA-F]{6}$/);
    // #ff0000 (#FF0000) 与 #0000ff 平均 ≈ #800080
    expect(fill.color.toLowerCase()).toBe("800080");
  });

  it("纯色 fill 直接返回该色", () => {
    const fill = resolveFill({ fill: "#abc123" }, {});
    expect(fill.color.toLowerCase()).toBe("abc123");
  });
});

describe("translateSvgToSlide 渐变与路径", () => {
  it("fill 为 linearGradient 的 rect 翻译为平均色且不抛错", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="g">
          <stop offset="0" stop-color="#ff0000"/>
          <stop offset="1" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
      <rect x="100" y="50" width="300" height="120" fill="url(#g)"/>
    </svg>`;
    const slide = createMockSlide();
    expect(() => translateSvgToSlide(svg, slide)).not.toThrow();

    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    expect(shapeCall).toBeDefined();
    const [, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { fill: { color: string } },
    ];
    expect(opts.fill.color.toLowerCase()).toBe("800080");
  });

  it("含 path 的 svg 不崩溃", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <path d="M0 0 L10 10 L20 0 Z" fill="#00ff00" x="50" y="60" width="100" height="80"/>
    </svg>`;
    const slide = createMockSlide();
    expect(() => translateSvgToSlide(svg, slide)).not.toThrow();
    // 闭合带 fill 的 path 降级为覆盖 bounding box 的 rect
    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    expect(shapeCall).toBeDefined();
    const [type, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number; w: number; h: number; fill: { color: string } },
    ];
    expect(type).toBe("rect");
    expect(opts.fill.color.toLowerCase()).toBe("00ff00");
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
