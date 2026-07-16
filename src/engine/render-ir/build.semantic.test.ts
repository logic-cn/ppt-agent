import { describe, it, expect } from "vitest";
import { buildRenderSlide } from "./build";
import type { RenderNode } from "./types";
import type { Slide } from "@/types/deck";
import type { Theme } from "@/types/theme";

const theme: Theme = {
  id: "test",
  name: "测试",
  colors: {
    primary: "#111",
    secondary: "#666",
    accent: "#f00",
    background: "#fff",
    surface: "#eee",
    text: "#222",
    textMuted: "#888",
  },
  fonts: { title: "sans-serif", body: "sans-serif" },
  fontSize: { h1: 44, h2: 32, body: 18, caption: 14 },
  spacing: "comfortable",
};

function makeSlide(partial: Partial<Slide>): Slide {
  return {
    id: "s1",
    layout: "content",
    title: "标题",
    ...partial,
  } as Slide;
}

describe("语义化布局渲染", () => {
  it("metrics 布局产出大数字与说明节点", () => {
    const slide = makeSlide({
      layout: "metrics",
      title: "核心数字",
      metric: {
        value: "970",
        unit: "亿美元",
        label: "2024 年市场规模",
        kicker: "突破",
      },
    });
    const rs = buildRenderSlide(slide, {} as never, theme);
    expect(rs.nodes.length).toBeGreaterThan(1);
    const metricNode = rs.nodes.find(
      (n) => n.type === "text" && String(n.text).includes("970"),
    );
    expect(metricNode).toBeDefined();
  });

  it("quote 布局产出引述节点与署名节点", () => {
    const slide = makeSlide({
      layout: "quote",
      quote: "AI 是未来十年最大的结构性机会",
      attribution: "—— 某研究院",
    });
    const rs = buildRenderSlide(slide, {} as never, theme);
    const quoteNode = rs.nodes.find(
      (n) => n.type === "text" && n.text === "AI 是未来十年最大的结构性机会",
    );
    expect(quoteNode).toBeDefined();
    const attrNode = rs.nodes.find(
      (n) => n.type === "text" && n.text === "—— 某研究院",
    );
    expect(attrNode).toBeDefined();
  });

  it("metrics 布局拼接单位与 kicker", () => {
    const slide = makeSlide({
      layout: "metrics",
      title: "核心数字",
      metric: {
        value: "970",
        unit: "亿美元",
        label: "2024 年市场规模",
        kicker: "突破",
      },
    });
    const rs = buildRenderSlide(slide, {} as never, theme);
    const metricNode = rs.nodes.find(
      (n): n is Extract<RenderNode, { type: "text" }> =>
        n.type === "text" && String(n.text).includes("970 亿美元"),
    );
    expect(metricNode).toBeDefined();
    expect(metricNode!.text).toContain("突破");
  });

  it("timeline 布局按 items 节点数生成圆点与文字", () => {
    const slide = makeSlide({
      layout: "timeline",
      title: "演进路径",
      items: [
        { id: "1", title: "起步", body: "概念验证" },
        { id: "2", title: "成长", body: "规模扩张" },
        { id: "3", title: "成熟", body: "生态完善" },
      ],
    });
    const rs = buildRenderSlide(slide, {} as never, theme);
    const dots = rs.nodes.filter(
      (n) => n.type === "shape" && n.shape === "circle",
    );
    expect(dots.length).toBe(3);
  });

  it("timeline 超过 5 个节点时只渲染前 5 个", () => {
    const slide = makeSlide({
      layout: "timeline",
      title: "长路径",
      items: Array.from({ length: 7 }, (_, i) => ({
        id: String(i),
        title: `阶段${i}`,
        body: `内容${i}`,
      })),
    });
    const rs = buildRenderSlide(slide, {} as never, theme);
    const dots = rs.nodes.filter(
      (n) => n.type === "shape" && n.shape === "circle",
    );
    expect(dots.length).toBe(5);
  });
});
