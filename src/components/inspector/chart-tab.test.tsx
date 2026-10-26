import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Slide } from "@/types/deck";
import type { SpecLock } from "@/design/spec-lock";
import { useSettingsStore } from "@/store/settings";
import { ChartTab } from "./chart-tab";

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
  fonts: { title: "sans-serif", body: "sans-serif" },
  typography: { title: 40, section: 28, body: 18, caption: 12, hero: 72 },
  style: "swiss-minimal",
  icons: [],
};

function makeSlide(svg: string, withChart = true): Slide {
  return {
    id: "s1",
    layout: "chart",
    title: "营收",
    svg,
    chart: withChart
      ? {
          type: "bar",
          title: "旧标题",
          data: [{ label: "一月", value: 10 }],
        }
      : undefined,
  };
}

const svgWithChart = `<svg viewBox="0 0 1280 720"><g data-chart-type="bar" data-chart-data='[{"label":"一月","value":10}]'></g></svg>`;
const svgWithoutChart = `<svg viewBox="0 0 1280 720"><text x="10" y="20">无图表</text></svg>`;

describe("ChartTab", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
  });

  it("修改图表标题时同步更新 SVG 并清除过期标记", () => {
    const onUpdate = vi.fn();
    render(
      <ChartTab
        slide={makeSlide(svgWithChart)}
        specLock={spec}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("旧标题"), {
      target: { value: "新标题" },
    });
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.chart?.title).toBe("新标题");
    expect(patch.svg).toContain('data-chart-title="新标题"');
    expect(patch.svg).toContain("新标题");
    expect(patch.svgStale).toBeUndefined();
  });

  it("删除图表时从 SVG 移除图表组", () => {
    const onUpdate = vi.fn();
    render(
      <ChartTab
        slide={makeSlide(svgWithChart)}
        specLock={spec}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText("删除图表"));
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.chart).toBeUndefined();
    expect(patch.svg).not.toContain("data-chart-type");
    expect(patch.svgStale).toBeUndefined();
  });

  it("页面没有图表区域时标记为待重画", () => {
    const onUpdate = vi.fn();
    render(
      <ChartTab
        slide={makeSlide(svgWithoutChart, false)}
        specLock={spec}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText("添加图表"));
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.chart?.type).toBe("bar");
    expect(patch.svgStale).toBe(true);
  });

  it("无 SVG 的历史页只更新结构化图表数据", () => {
    const onUpdate = vi.fn();
    const slide = { ...makeSlide("", true), svg: undefined };
    render(<ChartTab slide={slide} specLock={spec} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByDisplayValue("旧标题"), {
      target: { value: "新标题" },
    });
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.chart?.title).toBe("新标题");
    expect(patch.svg).toBeUndefined();
    expect(patch.svgStale).toBeUndefined();
  });
});
