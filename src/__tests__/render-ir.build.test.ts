import { describe, it, expect } from "vitest";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { validateRenderSlides } from "@/engine/render-ir/validate";
import type { Deck, Slide } from "@/types/deck";
import type { Theme } from "@/types/theme";

function mockTheme(): Theme {
  return {
    id: "test",
    name: "Test",
    colors: {
      primary: "#1a56db",
      secondary: "#7c3aed",
      accent: "#f59e0b",
      background: "#ffffff",
      surface: "#f9fafb",
      text: "#111827",
      textMuted: "#6b7280",
    },
    fonts: { title: "sans-serif", body: "sans-serif" },
    fontSize: { h1: 36, h2: 24, body: 16, caption: 12 },
    spacing: "comfortable",
  };
}

function makeSlide(overrides?: Partial<Slide>): Slide {
  return {
    id: "s1",
    layout: "content",
    title: "测试页面",
    ...overrides,
  };
}

describe("buildRenderSlides", () => {
  it("生成 RenderSlide 包含 nodes", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "test",
      },
      slides: [makeSlide()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Deck;
    const theme = mockTheme();
    const slides = buildRenderSlides(deck, theme);
    expect(slides).toHaveLength(1);
    expect(slides[0].id).toBe("s1");
    expect(slides[0].nodes.length).toBeGreaterThan(0);
  });

  it("cover 布局包含顶部装饰条", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "test",
      },
      slides: [makeSlide({ layout: "cover", title: "封面" })],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Deck;
    const theme = mockTheme();
    const slides = buildRenderSlides(deck, theme);
    const topBars = slides[0].nodes.filter((n) => n.id === "deco-top-bar");
    expect(topBars).toHaveLength(1);
  });

  it("content 布局包含侧边装饰条", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "test",
      },
      slides: [makeSlide({ layout: "content" })],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Deck;
    const theme = mockTheme();
    const slides = buildRenderSlides(deck, theme);
    const sideBars = slides[0].nodes.filter((n) => n.id === "deco-side-bar");
    expect(sideBars).toHaveLength(1);
  });

  it("包含标题文本节点", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "test",
      },
      slides: [makeSlide({ title: "页面标题" })],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Deck;
    const theme = mockTheme();
    const slides = buildRenderSlides(deck, theme);
    const titleNodes = slides[0].nodes.filter(
      (n) => n.type === "text" && n.id === "slide-title",
    );
    expect(titleNodes).toHaveLength(1);
    if (titleNodes[0].type === "text") {
      expect(titleNodes[0].text).toBe("页面标题");
    }
  });

  it("无布局时生成空节点", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "test",
      },
      slides: [makeSlide({ layout: "nonexistent" as "content" })],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Deck;
    const theme = mockTheme();
    const slides = buildRenderSlides(deck, theme);
    expect(slides[0].nodes).toHaveLength(0);
  });
});

describe("validateRenderSlides", () => {
  it("空节点报 warning", () => {
    const slides = [
      { id: "s1", background: "#fff", nodes: [], notes: undefined },
    ];
    const warnings = validateRenderSlides(slides);
    expect(warnings.some((w) => w.code === "empty_nodes")).toBe(true);
  });

  it("图片节点缺少 URL 报 warning", () => {
    const slides = [
      {
        id: "s1",
        background: "#fff",
        nodes: [
          {
            type: "image" as const,
            id: "img1",
            rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
            src: undefined,
            alt: "test",
            fit: "cover" as const,
            zIndex: 1,
          },
        ],
        notes: undefined,
      },
    ];
    const warnings = validateRenderSlides(slides);
    expect(warnings.some((w) => w.code === "missing_image_url")).toBe(true);
  });
});

describe("无 visual 区布局的图表渲染（UI 测试回归）", () => {
  it("正文布局带图表：图表落到下半区默认矩形，正文收窄不重叠", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {} as Deck["design"],
      slides: [
        makeSlide({
          layout: "content",
          body: "正文文字",
          chart: {
            type: "bar",
            title: "季度营收",
            data: [
              { label: "Q1", value: 100 },
              { label: "Q2", value: 140 },
            ],
          },
        }),
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as Deck;

    const [rs] = buildRenderSlides(deck, mockTheme());
    const chartNode = rs.nodes.find((n) => n.type === "chart");
    expect(chartNode).toBeDefined();
    // 图表不使用默认 visual（content 布局没有 visual），落到下半区
    expect(chartNode!.rect.y).toBeGreaterThanOrEqual(0.4);
    // 正文收窄：底边不超过图表上缘
    const bodyNode = rs.nodes.find((n) => n.id === "slide-body");
    expect(bodyNode).toBeDefined();
    expect(bodyNode!.rect.y + bodyNode!.rect.h).toBeLessThanOrEqual(0.46);
  });

  it("chart 布局仍使用布局自带的 visual 区（行为不变）", () => {
    const deck = {
      id: "test",
      version: 2,
      title: "测试",
      design: {} as Deck["design"],
      slides: [
        makeSlide({
          layout: "chart",
          chart: {
            type: "bar",
            data: [{ label: "A", value: 1 }],
          },
        }),
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as Deck;

    const [rs] = buildRenderSlides(deck, mockTheme());
    const chartNode = rs.nodes.find((n) => n.type === "chart");
    expect(chartNode).toBeDefined();
    expect(chartNode!.rect).toEqual({ x: 0.1, y: 0.22, w: 0.8, h: 0.68 });
  });
});
