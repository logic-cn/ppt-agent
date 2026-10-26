import { describe, expect, it } from "vitest";
import type { SpecLock } from "@/design/spec-lock";
import type { ChartSpec } from "@/types/deck";
import {
  removeChartFromSvg,
  svgHasChartGroup,
  syncChartInSvg,
} from "./sync-chart";

const spec: SpecLock = {
  canvas: { w: 1280, h: 720 },
  canvasFormat: "ppt-16-9",
  colors: {
    primary: "#2563EB",
    secondary: "#7C3AED",
    accent: "#F59E0B",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    text: "#0F172A",
    textMuted: "#64748B",
  },
  fonts: { title: "'Source Han Sans CN', sans-serif", body: "Noto Sans SC" },
  typography: { title: 40, section: 28, body: 18, caption: 12, hero: 72 },
  style: "swiss-minimal",
  icons: [],
};

const baseSvg = `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg"><rect width="1280" height="720" fill="#FFFFFF"/><text x="80" y="80" font-size="40" fill="#0F172A">标题</text><g data-chart-type="bar" data-chart-data='[{"label":"旧","value":1}]'><rect x="100" y="300" width="20" height="80" fill="#000"/></g></svg>`;

function chart(patch: Partial<ChartSpec> = {}): ChartSpec {
  return {
    type: "bar",
    data: [
      { label: "一月", value: 12 },
      { label: "二月", value: 20 },
      { label: "三月", value: 8 },
    ],
    ...patch,
  };
}

describe("syncChartInSvg", () => {
  it("更新图表属性并重绘组内图形", () => {
    const result = syncChartInSvg(baseSvg, chart({ title: "季度趋势" }), spec);
    expect(result.synced).toBe(true);
    expect(result.svg).toContain('data-chart-type="bar"');
    expect(result.svg).toContain("季度趋势");
    expect(result.svg).toContain('data-chart-title="季度趋势"');
    expect(result.svg).toContain("一月");
    expect(result.svg).toContain("二月");
    expect(result.svg).toContain("三月");
    expect(result.svg).not.toContain(">旧<");
    expect(result.svg).toContain("<rect");
    expect(result.svg).toContain("<text");
    expect(result.svg).toContain("标题");
  });

  it("支持 line / pie / doughnut 重绘", () => {
    const line = syncChartInSvg(baseSvg, chart({ type: "line" }), spec);
    expect(line.svg).toContain("<polyline");
    expect(line.svg).toContain("<circle");

    const pie = syncChartInSvg(baseSvg, chart({ type: "pie" }), spec);
    expect(pie.svg).toContain("<path");
    expect(pie.svg).not.toContain("<circle");

    const doughnut = syncChartInSvg(baseSvg, chart({ type: "doughnut" }), spec);
    expect(doughnut.svg).toContain("<path");
    expect(doughnut.svg).toContain("<circle");
  });

  it("保留图表组原有位置属性，移除 transform 以避免预览/导出双重偏移", () => {
    const svg = `<svg viewBox="0 0 1280 720"><g transform="translate(120, 200)" opacity="0.9" data-chart-type="bar" data-chart-data='[{"label":"A","value":1}]'></g></svg>`;
    const result = syncChartInSvg(svg, chart(), spec);
    expect(result.svg).toContain('x="120"');
    expect(result.svg).toContain('y="200"');
    expect(result.svg).toContain('opacity="0.9"');
    expect(result.svg).not.toContain("transform=");
  });

  it("无图表组时返回原 SVG 并标记未同步", () => {
    const svg = `<svg viewBox="0 0 1280 720"><text x="10" y="20">无图表</text></svg>`;
    const result = syncChartInSvg(svg, chart(), spec);
    expect(result.synced).toBe(false);
    expect(result.svg).toBe(svg);
  });

  it("转义标签与标题中的 XML 特殊字符", () => {
    const result = syncChartInSvg(
      baseSvg,
      chart({ title: 'A&B "C"', data: [{ label: "<D>", value: 1 }] }),
      spec,
    );
    expect(result.svg).toContain("A&amp;B &quot;C&quot;");
    expect(result.svg).toContain("&lt;D&gt;");
    expect(result.svg).not.toContain("<D>");
  });

  it("空数据渲染占位符而不是非法图表", () => {
    const result = syncChartInSvg(baseSvg, chart({ data: [] }), spec);
    expect(result.svg).toContain('data-chart-data="[]"');
    expect(result.svg).toContain("—");
  });
});

describe("removeChartFromSvg", () => {
  it("移除带 data-chart-type 的组", () => {
    const result = removeChartFromSvg(baseSvg);
    expect(result.removed).toBe(true);
    expect(result.svg).not.toContain("data-chart-type");
    expect(result.svg).toContain("标题");
  });

  it("没有图表组时原样返回", () => {
    const svg = "<svg><rect/></svg>";
    expect(removeChartFromSvg(svg)).toEqual({ svg, removed: false });
  });
});

describe("svgHasChartGroup", () => {
  it("识别图表组", () => {
    expect(svgHasChartGroup(baseSvg)).toBe(true);
    expect(svgHasChartGroup("<svg><rect/></svg>")).toBe(false);
    expect(svgHasChartGroup(undefined)).toBe(false);
  });
});
