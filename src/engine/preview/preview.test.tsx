import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Deck, Slide } from "@/types/deck";
import { SlidePreview } from "./index";
import { useDeckStore } from "@/store/deck";

// jsdom 无 ResizeObserver，SlidePreview 的容器测量需要 stub
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

vi.mock("@/engine/render-ir/build", () => ({
  buildRenderSlideCached: vi.fn(() => ({ nodes: [] })),
}));
vi.mock("./render-slide-viewer", () => ({
  RenderSlideViewer: () => <div data-testid="fallback-viewer" />,
}));
vi.mock("@/components/SvgViewer", () => ({
  SvgViewer: ({ svg }: { svg: string }) => (
    <div data-testid="svg-viewer">{svg}</div>
  ),
}));

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"></svg>';

function makeDeck(slides: Slide[]): Deck {
  return {
    id: "d1",
    version: 2,
    title: "测试",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("SlidePreview svgStale 提示", () => {
  beforeEach(() => {
    useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  });

  it("svgStale 时显示内容已修改提示且重画按钮变为重画同步", () => {
    const slide: Slide = {
      id: "s1",
      layout: "content",
      title: "T",
      svg: SVG,
      svgStale: true,
    };
    render(<SlidePreview deck={makeDeck([slide])} />);

    expect(screen.getByText(/内容已修改/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "重画同步" })).toBeTruthy();
  });

  it("svg 未过期时不显示提示，按钮为默认文案", () => {
    const slide: Slide = { id: "s1", layout: "content", title: "T", svg: SVG };
    render(<SlidePreview deck={makeDeck([slide])} />);

    expect(screen.queryByText(/内容已修改/)).toBeNull();
    expect(screen.getByRole("button", { name: "重画此页" })).toBeTruthy();
  });

  it("无 svg 的页不显示提示", () => {
    const slide: Slide = { id: "s1", layout: "content", title: "T" };
    render(<SlidePreview deck={makeDeck([slide])} />);

    expect(screen.queryByText(/内容已修改/)).toBeNull();
    expect(screen.getByTestId("fallback-viewer")).toBeTruthy();
  });
});
