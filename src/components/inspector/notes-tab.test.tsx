import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Slide } from "@/types/deck";
import { useSettingsStore } from "@/store/settings";
import { NotesTab } from "./notes-tab";

function makeSlide(patch: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    layout: "content",
    title: "标题",
    ...patch,
  };
}

describe("NotesTab", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
  });

  it("展示已有备注内容", () => {
    render(
      <NotesTab
        slide={makeSlide({ notes: "开场先讲背景" })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("开场先讲背景")).toBeTruthy();
  });

  it("无备注时显示占位提示", () => {
    render(<NotesTab slide={makeSlide()} onUpdate={vi.fn()} />);
    expect(screen.getByPlaceholderText("输入演讲者备注…")).toBeTruthy();
  });

  it("展示备注会导出到 PPTX 的说明文案", () => {
    render(<NotesTab slide={makeSlide()} onUpdate={vi.fn()} />);
    expect(screen.getByText(/Speaker Notes/)).toBeTruthy();
  });

  it("连续输入合并为一次提交，300ms 后落盘最终值", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    render(<NotesTab slide={makeSlide()} onUpdate={onUpdate} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "第一" } });
    fireEvent.change(textarea, { target: { value: "第一段" } });
    fireEvent.change(textarea, { target: { value: "第一段讲背景" } });
    expect(onUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ notes: "第一段讲背景" });
  });

  it("清空备注时提交 undefined 而非空字符串", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    render(
      <NotesTab slide={makeSlide({ notes: "旧备注" })} onUpdate={onUpdate} />,
    );
    fireEvent.change(screen.getByDisplayValue("旧备注"), {
      target: { value: "" },
    });
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(onUpdate).toHaveBeenCalledWith({ notes: undefined });
  });

  it("切换页面时草稿跟随新页备注", () => {
    const { rerender } = render(
      <NotesTab
        slide={makeSlide({ notes: "第一页备注" })}
        onUpdate={vi.fn()}
      />,
    );
    rerender(
      <NotesTab
        slide={makeSlide({ id: "s2", notes: "第二页备注" })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("第二页备注")).toBeTruthy();
  });

  it("外部改动备注（AI patch / 撤销）会同步到输入框", () => {
    const { rerender } = render(
      <NotesTab slide={makeSlide({ notes: "原始备注" })} onUpdate={vi.fn()} />,
    );
    rerender(
      <NotesTab
        slide={makeSlide({ notes: "AI 改写后的备注" })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("AI 改写后的备注")).toBeTruthy();
  });
});
