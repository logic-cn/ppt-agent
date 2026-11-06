import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Slide } from "@/types/deck";
import { useSettingsStore } from "@/store/settings";
import { SlideTab } from "./slide-tab";

function makeSlide(patch: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    layout: "content",
    title: "原标题",
    subtitle: "",
    body: "",
    ...patch,
  };
}

describe("SlideTab", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
    vi.useRealTimers();
  });

  it("一个字段落盘引起 props 变化时，不丢弃其它字段尚未触发的输入", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { rerender, container } = render(
      <SlideTab slide={makeSlide()} onUpdate={onUpdate} />,
    );

    // 300ms 内先后输入标题与正文
    fireEvent.change(screen.getByDisplayValue("原标题"), {
      target: { value: "新标题" },
    });
    fireEvent.change(container.querySelector("textarea")!, {
      target: { value: "不应丢失的正文" },
    });

    // 模拟标题防抖先落盘、父组件回传新的 title（正文仍在等待中）
    rerender(
      <SlideTab slide={makeSlide({ title: "新标题" })} onUpdate={onUpdate} />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ body: "不应丢失的正文" }),
    );
  });
});
