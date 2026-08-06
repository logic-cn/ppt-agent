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
    addChart: vi.fn((...args: unknown[]) =>
      calls.push({ kind: "chart", args }),
    ),
    addImage: vi.fn((...args: unknown[]) =>
      calls.push({ kind: "image", args }),
    ),
    addNotes: vi.fn((...args: unknown[]) =>
      calls.push({ kind: "notes", args }),
    ),
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
    // 32 viewBox px × 0.75 = 24pt
    expect(opts.fontSize).toBeCloseTo(24, 2);
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

describe("translateSvgToSlide 原生图表", () => {
  it("含 data-chart-type 的 g 调用 addChart 渲染原生图表", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <g data-chart-type="bar" data-chart-data='[{"label":"A","value":10},{"label":"B","value":20}]' x="100" y="100" width="600" height="400"></g>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);

    const chartCall = slide._calls.find((c) => c.kind === "chart");
    expect(chartCall).toBeDefined();
    const [type, data, opts] = (chartCall as { args: unknown[] }).args as [
      string,
      { name: string; labels: string[]; values: number[] }[],
      { x: number; y: number; w: number; h: number },
    ];
    expect(type).toContain("bar");
    expect(data[0].labels).toEqual(["A", "B"]);
    expect(data[0].values).toEqual([10, 20]);
    // 100/1280*13.333 ≈ 1.0416; 100/720*7.5 ≈ 1.0417
    expect(opts.x).toBeCloseTo(1.0416, 3);
    expect(opts.y).toBeCloseTo(1.0417, 3);
  });

  it("非法 data-chart-type 不调用 addChart", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <g data-chart-type="unknown" data-chart-data='[{"label":"A","value":10}]' x="100" y="100" width="600" height="400"></g>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    expect(slide._calls.find((c) => c.kind === "chart")).toBeUndefined();
  });

  it("图表 g 用 transform=translate 定位时正确取偏移坐标", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <g data-chart-type="bar" data-chart-data='[{"label":"A","value":10},{"label":"B","value":20}]' transform="translate(120, 470)" width="1040" height="190"></g>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);

    const chartCall = slide._calls.find((c) => c.kind === "chart");
    expect(chartCall).toBeDefined();
    const opts = (chartCall as { args: unknown[] }).args[2] as {
      x: number;
      y: number;
    };
    // 120/1280*13.333 ≈ 1.25; 470/720*7.5 ≈ 4.8958
    expect(opts.x).toBeCloseTo(1.25, 3);
    expect(opts.y).toBeCloseTo(4.8958, 3);
  });

  it("data-chart-title 导出为原生图表标题", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <g data-chart-type="pie" data-chart-title="季度占比" data-chart-data='[{"label":"A","value":10}]' x="100" y="100" width="600" height="400"></g>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const chartCall = slide._calls.find((c) => c.kind === "chart");
    const opts = (chartCall as { args: unknown[] }).args[2] as {
      showTitle: boolean;
      title?: string;
    };
    expect(opts.showTitle).toBe(true);
    expect(opts.title).toBe("季度占比");
  });
});

describe("translateSvgToSlide 元素覆盖与备注", () => {
  it("标准 path（无 x/y/width/height）从 d 解析包围盒降级为 rect", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <path d="M100 200 L300 200 L300 400 L100 400 Z" fill="#00ff00"/>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    expect(shapeCall).toBeDefined();
    const [type, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number; w: number; h: number },
    ];
    expect(type).toBe("rect");
    // 100/1280*13.333 ≈ 1.0416; 200/720*7.5 ≈ 2.0833
    expect(opts.x).toBeCloseTo(1.0416, 3);
    expect(opts.y).toBeCloseTo(2.0833, 3);
    expect(opts.w).toBeCloseTo((200 / 1280) * 13.333, 3);
    expect(opts.h).toBeCloseTo((200 / 720) * 7.5, 3);
  });

  it("polygon 翻译为包围盒矩形", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <polygon points="100,100 200,100 150,200" fill="#ff0000"/>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    expect(shapeCall).toBeDefined();
    const [type, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { fill: { color: string } },
    ];
    expect(type).toBe("rect");
    expect(opts.fill.color.toLowerCase()).toBe("ff0000");
  });

  it("polyline 翻译为 line 形状", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <polyline points="100,100 300,150 500,120" stroke="#0000ff" fill="none"/>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    expect(shapeCall).toBeDefined();
    const [type] = (shapeCall as { args: unknown[] }).args as [string];
    expect(type).toBe("line");
  });

  it("data: 内嵌 image 翻译为 addImage", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <image href="data:image/png;base64,AAA" x="10" y="20" width="100" height="80"/>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const imgCall = slide._calls.find((c) => c.kind === "image");
    expect(imgCall).toBeDefined();
    const opts = (imgCall as { args: unknown[] }).args[0] as {
      data: string;
      x: number;
    };
    expect(opts.data.startsWith("image/png;base64,")).toBe(true);
    expect(opts.x).toBeCloseTo((10 / 1280) * 13.333, 3);
  });

  it("text-anchor=middle 时文本框居中定位且 y 按基线上移", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="640" y="360" font-size="40" fill="#111111" text-anchor="middle">居中标题</text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCall = slide._calls.find((c) => c.kind === "text");
    const [, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number; w: number; align: string; fontSize: number },
    ];
    expect(opts.align).toBe("center");
    // 框中心 ≈ 640px：x + w/2 ≈ 640/1280*13.333 = 6.6665
    expect(opts.x + opts.w / 2).toBeCloseTo(6.6665, 2);
    // y = (360 - 40*0.78)/720*7.5 ≈ 3.425
    expect(opts.y).toBeCloseTo(((360 - 40 * 0.78) / 720) * 7.5, 2);
    expect(opts.fontSize).toBeCloseTo(30, 2);
  });

  it("tspan 继承父 text 的 font-size 与 fill", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="28" fill="#222222">
        <tspan x="100" y="200">继承</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCall = slide._calls.find((c) => c.kind === "text");
    const [, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { fontSize: number; color: string },
    ];
    expect(opts.fontSize).toBeCloseTo(21, 2);
    expect(opts.color.toLowerCase()).toBe("222222");
  });

  it("嵌套 tspan 沿链继承祖先的 font-size 与 fill 且只渲染一次", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="24" fill="#333333">
        <tspan>
          <tspan>深层继承</tspan>
        </tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCalls = slide._calls.filter((c) => c.kind === "text");
    // 外层 tspan 含内层 tspan，其直接文本由内层渲染，不得重复 addText
    expect(textCalls).toHaveLength(1);
    const [, opts] = textCalls[0].args as [
      string,
      { fontSize: number; color: string },
    ];
    expect(opts.fontSize).toBeCloseTo(18, 2);
    expect(opts.color.toLowerCase()).toBe("333333");
  });

  it("tspan 无 x/y 时继承父 text 定位", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">
        <tspan>定位继承</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCall = slide._calls.find((c) => c.kind === "text");
    const [, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number },
    ];
    // x=100 与 y=200 均来自父 text
    expect(opts.x).toBeCloseTo((100 / 1280) * 13.333, 3);
    expect(opts.y).toBeCloseTo(((200 - 20 * 0.78) / 720) * 7.5, 3);
  });

  it("tspan 的 dx/dy 相对偏移叠加到继承位置", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222" dx="10">
        <tspan dx="20" dy="30">偏移叠加</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCall = slide._calls.find((c) => c.kind === "text");
    const [, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number },
    ];
    // x = 100 + 10(text.dx) + 20(tspan.dx) = 130；y = 200 + 30(tspan.dy)
    expect(opts.x).toBeCloseTo((130 / 1280) * 13.333, 3);
    expect(opts.y).toBeCloseTo(((230 - 20 * 0.78) / 720) * 7.5, 3);
  });

  it("tspan 带显式 x/y 时不累计祖先的 dx/dy（绝对坐标优先）", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222" dx="50">
        <tspan x="300" y="100">绝对定位</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCall = slide._calls.find((c) => c.kind === "text");
    const [, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number },
    ];
    // 位置取 tspan 显式 x/y，父 text 的 dx=50 不参与
    expect(opts.x).toBeCloseTo((300 / 1280) * 13.333, 3);
    expect(opts.y).toBeCloseTo(((100 - 20 * 0.78) / 720) * 7.5, 3);
  });

  it("text 混合内容：前缀/后缀/tspan 各自渲染且互不重复", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">前缀
        <tspan x="260" y="200">子段</tspan>后缀
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const calls = slide._calls.filter((c) => c.kind === "text");
    // 前缀/后缀/tspan 各渲染一次，无重复
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => (c.args as [string])[0])).toEqual([
      "前缀",
      "后缀",
      "子段",
    ]);
    const [, suffixOpts] = calls[1].args as [string, { x: number; y: number }];
    // 后缀跟随 tspan 流终点：tspan 显式 x=260 字形宽 40（2 CJK × 20），终点 300
    expect(suffixOpts.x).toBeCloseTo((300 / 1280) * 13.333, 3);
    expect(suffixOpts.y).toBeCloseTo(((200 - 20 * 0.78) / 720) * 7.5, 3);
  });

  it("tspan 无显式 x 时起点补偿父 text 前缀文本宽度", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">前缀
        <tspan>子段</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCalls = slide._calls.filter((c) => c.kind === "text");
    expect(textCalls).toHaveLength(2);
    const [, prefixOpts] = textCalls[0].args as [string, { x: number }];
    const [, tspanOpts] = textCalls[1].args as [string, { x: number }];
    // 前缀 "前缀" 2 个 CJK × 20px = 40px 字形宽，tspan 起点右移该宽度
    const prefixW = 2 * 20;
    expect(prefixOpts.x).toBeCloseTo((100 / 1280) * 13.333, 3);
    expect(tspanOpts.x).toBeCloseTo(((100 + prefixW) / 1280) * 13.333, 3);
  });

  it("连续无定位 tspan 流式排布，后续起点累计前序字形宽", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">前
        <tspan>一</tspan>
        <tspan>二</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const tspanCalls = slide._calls.filter((c) => c.kind === "text").slice(1);
    const [, firstOpts] = tspanCalls[0].args as [string, { x: number }];
    const [, secondOpts] = tspanCalls[1].args as [string, { x: number }];
    // 前缀 "前" 字形宽 20；tspan1 起点 120，tspan2 起点 = 120 + 20（tspan1 宽）
    expect(firstOpts.x).toBeCloseTo((120 / 1280) * 13.333, 3);
    expect(secondOpts.x).toBeCloseTo((140 / 1280) * 13.333, 3);
  });

  it("text-anchor=middle 时相邻块字形首尾相接不重叠", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="640" y="200" font-size="20" fill="#222222" text-anchor="middle">前
        <tspan>一</tspan>
        <tspan>二</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const tspanCalls = slide._calls.filter((c) => c.kind === "text").slice(1);
    const [, firstOpts] = tspanCalls[0].args as [
      string,
      { x: number; w: number },
    ];
    const [, secondOpts] = tspanCalls[1].args as [
      string,
      { x: number; w: number },
    ];
    // middle 下每块字形居中于 xBox + w/2：前缀 "前" 字形宽 20 推进 20，
    // tspan1 中心 660、tspan2 中心 680；相邻字形区间 [640,660]/[660,680]
    // 恰好首尾相接，无重叠无间隙
    const fs = 20;
    expect(firstOpts.x + firstOpts.w / 2).toBeCloseTo((660 / 1280) * 13.333, 3);
    expect(secondOpts.x + secondOpts.w / 2).toBeCloseTo(
      (680 / 1280) * 13.333,
      3,
    );
    const center1 = (660 / 1280) * 13.333;
    const center2 = (680 / 1280) * 13.333;
    const glyphHalf = (fs / 2 / 1280) * 13.333;
    // 字形区间 [center-fs/2, center+fs/2] 互不重叠
    expect(center1 + glyphHalf).toBeCloseTo(center2 - glyphHalf, 3);
  });

  it("嵌套 tspan：外层显式 x 后内层沿用其右缘，外层直接文本不丢失", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">
        <tspan x="260">外<tspan>内</tspan>尾</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const calls = slide._calls
      .filter((c) => c.kind === "text")
      .map((c) => c.args as [string, { x: number }]);
    // 外层前缀 "外" 渲染于显式 x=260；内层 "内" 跟随外层右缘 260+20=280；
    // 外层后缀 "尾" 跟随内层右缘 280+20=300
    const byText = new Map(calls.map(([t, o]) => [t, o]));
    expect(byText.get("外")!.x).toBeCloseTo((260 / 1280) * 13.333, 3);
    expect(byText.get("内")!.x).toBeCloseTo((280 / 1280) * 13.333, 3);
    expect(byText.get("尾")!.x).toBeCloseTo((300 / 1280) * 13.333, 3);
  });

  it("text-anchor=end 时流从右缘继续，无定位 tspan 不叠回锚点", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="200" y="200" font-size="20" fill="#222222" text-anchor="end">前
        <tspan>一</tspan>
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const [, tspanOpts] = slide._calls
      .filter((c) => c.kind === "text")
      .slice(1)[0].args as [string, { x: number; w: number }];
    // 前缀 "前" 字形 [180,200]（右缘贴锚点 200）；tspan 流位置 220，
    // 右对齐渲染时框右缘 = 220（字形 [200,220] 与前缀首尾相接）
    expect(tspanOpts.x + tspanOpts.w).toBeCloseTo((220 / 1280) * 13.333, 3);
  });

  it("仅后缀无前缀：text 直接文本跟随首个 tspan 流终点", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">
        <tspan>子段</tspan>后缀
      </text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCalls = slide._calls.filter((c) => c.kind === "text");
    expect(textCalls).toHaveLength(2);
    // 渲染顺序为文档序：text 分支先渲染后缀，tspan 分支随后渲染
    const [, suffixOpts] = textCalls[0].args as [string, { x: number }];
    const [, tspanOpts] = textCalls[1].args as [string, { x: number }];
    // 首个 tspan 无显式 x：起点 = text x=100；后缀跟随其右缘 100+40=140
    expect(tspanOpts.x).toBeCloseTo((100 / 1280) * 13.333, 3);
    expect(suffixOpts.x).toBeCloseTo((140 / 1280) * 13.333, 3);
  });

  it("多行纯文本按 SVG 默认折叠为单行，xml:space=preserve 保留原样", () => {
    const collapseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222">第一行
第二行</text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(collapseSvg, slide);
    const [collapseText] = slide._calls
      .filter((c) => c.kind === "text")
      .map((c) => c.args as [string]);
    // 换行折叠为单空格（SVG 默认 white-space 语义）
    expect(collapseText[0]).toBe("第一行 第二行");

    const preserveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="200" font-size="20" fill="#222222" xml:space="preserve">第一行
第二行</text>
    </svg>`;
    const slide2 = createMockSlide();
    translateSvgToSlide(preserveSvg, slide2);
    const [preserveText] = slide2._calls
      .filter((c) => c.kind === "text")
      .map((c) => c.args as [string]);
    // preserve 保留换行
    expect(preserveText[0]).toBe("第一行\n第二行");
  });

  it("传入 notes 时调用 addNotes", () => {
    const slide = createMockSlide();
    translateSvgToSlide(SAMPLE_SVG, slide, undefined, "这是演讲备注");
    const notesCall = slide._calls.find((c) => c.kind === "notes");
    expect(notesCall).toBeDefined();
    expect((notesCall as { args: unknown[] }).args[0]).toBe("这是演讲备注");
  });

  it("arc 命令的 rx/x-rot/flag 参数不污染包围盒", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <path d="M100 100 A 999 999 90 0 1 300 300 Z" fill="#00ff00"/>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    const [type, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { x: number; y: number; w: number; h: number },
    ];
    expect(type).toBe("rect");
    // 仅起点 (100,100) 与终点 (300,300) 参与包围盒；rx=999 / rot=90 / flag 不得混入
    expect(opts.x).toBeCloseTo((100 / 1280) * 13.333, 3);
    expect(opts.y).toBeCloseTo((100 / 720) * 7.5, 3);
    expect(opts.w).toBeCloseTo((200 / 1280) * 13.333, 3);
    expect(opts.h).toBeCloseTo((200 / 720) * 7.5, 3);
  });

  it("非法 stroke（url 渐变引用）回退为无描边", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
      <rect x="100" y="100" width="200" height="100" fill="#ff0000" stroke="url(#g)" stroke-width="4"/>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const shapeCall = slide._calls.find((c) => c.kind === "shape");
    const [, opts] = (shapeCall as { args: unknown[] }).args as [
      string,
      { line: { width: number } },
    ];
    expect(opts.line.width).toBe(0);
  });

  it("font-size 带非 px 单位时回退默认字号", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <text x="100" y="100" font-size="2em" fill="#111111">带单位字号</text>
    </svg>`;
    const slide = createMockSlide();
    translateSvgToSlide(svg, slide);
    const textCall = slide._calls.find((c) => c.kind === "text");
    const [, opts] = (textCall as { args: unknown[] }).args as [
      string,
      { fontSize: number },
    ];
    // 默认 18px × 0.75 = 13.5pt
    expect(opts.fontSize).toBeCloseTo(13.5, 2);
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

  it("端到端：含 svg 的 deck 导出真实 pptx Blob（size>1000 且含 xml/ppt 标记）", async () => {
    const E2E_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <rect x="100" y="50" width="300" height="120" rx="8" fill="#1A56DB"/>
      <text x="120" y="100" font-size="32" fill="#FFFFFF" text-anchor="start" font-family="sans-serif">端到端测试</text>
    </svg>`;
    const slides: Slide[] = [
      { id: "s1", layout: "content", title: "t", svg: E2E_SVG },
    ];
    const blob = await svgToPptx(slides, DEFAULT_DESIGN);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);

    // pptx 本质是 zip/xml，解出的字节应含 xml 声明或 ppt 目录标记
    const buf = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder().decode(buf);
    expect(text.includes("<?xml") || text.includes("ppt")).toBe(true);
  });
});
