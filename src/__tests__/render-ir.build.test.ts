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
    layouts: {
      cover: {
        title: { x: 0.1, y: 0.3, w: 0.8, h: 0.15 },
        body: { x: 0.1, y: 0.5, w: 0.8, h: 0.3 },
      },
      section: {
        title: { x: 0.1, y: 0.35, w: 0.8, h: 0.15 },
        body: { x: 0.1, y: 0.55, w: 0.8, h: 0.3 },
      },
      content: {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
        visual: { x: 0.55, y: 0.22, w: 0.4, h: 0.6 },
      },
      "two-column": {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.4, h: 0.7 },
        visual: { x: 0.52, y: 0.22, w: 0.4, h: 0.7 },
      },
      chart: {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
      },
      image: {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.55, w: 0.84, h: 0.35 },
        visual: { x: 0.08, y: 0.22, w: 0.84, h: 0.3 },
      },
      closing: {
        title: { x: 0.1, y: 0.35, w: 0.8, h: 0.15 },
        body: { x: 0.1, y: 0.55, w: 0.8, h: 0.3 },
      },
      "cols-2": {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
      },
      "cols-3": {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
      },
      "cols-4": {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
      },
      "cols-5": {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
      },
      "cols-6": {
        title: { x: 0.08, y: 0.08, w: 0.84, h: 0.1 },
        body: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
      },
    },
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
