import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PresentationMode } from "./presentation-mode";
import { resolveTheme } from "@/themes";
import type { Deck } from "@/types/deck";

// 放映键盘测试与页面渲染无关，隔离重度渲染组件以缩小测试依赖面
vi.mock("@/engine/preview/render-slide-viewer", () => ({
  RenderSlideViewer: () => <div data-testid="render-slide" />,
}));

function makeDeck(): Deck {
  return {
    id: "d1",
    title: "测试",
    version: 2,
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
      canvasFormat: "ppt-16-9",
    },
    slides: [
      { id: "s1", layout: "cover", title: "第一页", subtitle: "封面" },
      {
        id: "s2",
        layout: "content",
        title: "第二页",
        bullets: [{ id: "b1", text: "要点", level: 0 }],
        notes: "这是备注ABC",
      },
      { id: "s3", layout: "closing", title: "第三页", subtitle: "结束" },
    ],
    createdAt: 0,
    updatedAt: 0,
  } as Deck;
}

describe("PresentationMode 键盘操作", () => {
  it("ArrowRight 翻到下一页，N 显示备注，Escape 退出", () => {
    const onExit = vi.fn();
    render(
      <PresentationMode
        deck={makeDeck()}
        theme={resolveTheme("business-blue", "soft-rounded")}
        onExit={onExit}
      />,
    );

    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeTruthy();

    fireEvent.keyDown(window, { key: "n" });
    expect(screen.getByText("这是备注ABC")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalled();
  });

  it("放映期间独占方向键，底层监听不再同时翻页", () => {
    // 模拟编辑器底部预览的 window 冒泡监听：修复前它会先翻页并导致放映层
    // 监听在派发途中被重挂，方向键丢失
    const background = vi.fn();
    window.addEventListener("keydown", background);
    render(
      <PresentationMode
        deck={makeDeck()}
        theme={resolveTheme("business-blue", "soft-rounded")}
        onExit={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(background).not.toHaveBeenCalled();
    window.removeEventListener("keydown", background);
  });

  it("ArrowLeft 与 ArrowDown 均按方向翻页", () => {
    render(
      <PresentationMode
        deck={makeDeck()}
        theme={resolveTheme("business-blue", "soft-rounded")}
        initialIndex={1}
        onExit={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });
});
