import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Slide } from "@/types/deck";
import { useSettingsStore } from "@/store/settings";
import { SlideTab } from "./slide-tab";

function makeSlide(patch: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    layout: "content",
    title: "原始标题",
    ...patch,
  };
}

describe("SlideTab", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
  });

  it("渲染当前页的标题、副标题与正文", () => {
    render(
      <SlideTab
        slide={makeSlide({ subtitle: "副标题", body: "正文内容" })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("原始标题")).toBeTruthy();
    expect(screen.getByDisplayValue("副标题")).toBeTruthy();
    expect(screen.getByDisplayValue("正文内容")).toBeTruthy();
  });

  it("字段为空时输入框显示空串而不是受控告警", () => {
    render(<SlideTab slide={makeSlide()} onUpdate={vi.fn()} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.every((el) => el.value !== "undefined")).toBe(true);
  });

  it("修改布局立即提交，不走防抖", () => {
    const onUpdate = vi.fn();
    render(<SlideTab slide={makeSlide()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "two-column" },
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ layout: "two-column" });
  });

  it("连续输入标题只提交一次，且提交最终值", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    render(<SlideTab slide={makeSlide()} onUpdate={onUpdate} />);
    const input = screen.getByDisplayValue("原始标题");
    fireEvent.change(input, { target: { value: "季" } });
    fireEvent.change(input, { target: { value: "季度" } });
    fireEvent.change(input, { target: { value: "季度复盘" } });
    expect(onUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ title: "季度复盘" });
  });

  it("清空副标题时提交 undefined 而非空字符串", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    render(
      <SlideTab
        slide={makeSlide({ subtitle: "旧副标题" })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("旧副标题"), {
      target: { value: "" },
    });
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(onUpdate).toHaveBeenCalledWith({ subtitle: undefined });
  });

  it("清空正文时提交 undefined", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    render(
      <SlideTab slide={makeSlide({ body: "旧正文" })} onUpdate={onUpdate} />,
    );
    fireEvent.change(screen.getByDisplayValue("旧正文"), {
      target: { value: "" },
    });
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(onUpdate).toHaveBeenCalledWith({ body: undefined });
  });

  it("一个字段落盘不会清掉其它字段仍在等待的防抖定时器", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    render(<SlideTab slide={makeSlide()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByDisplayValue("原始标题"), {
      target: { value: "新标题" },
    });
    // 标题先落盘，props 随之变化
    vi.advanceTimersByTime(300);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 顺序为：标题 input、副标题 input、正文 textarea
    fireEvent.change(screen.getAllByRole("textbox")[1], {
      target: { value: "新副标题" },
    });
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("外部改动（AI patch / 撤销）会重置草稿", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <SlideTab slide={makeSlide()} onUpdate={onUpdate} />,
    );
    rerender(
      <SlideTab
        slide={makeSlide({ title: "AI 改写后的标题" })}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByDisplayValue("AI 改写后的标题")).toBeTruthy();
  });

  it("切换页面时重置草稿到新页内容", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <SlideTab slide={makeSlide()} onUpdate={onUpdate} />,
    );
    rerender(
      <SlideTab
        slide={makeSlide({ id: "s2", title: "第二页" })}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByDisplayValue("第二页")).toBeTruthy();
  });

  it("仅在有 bullets 时展示要点列表", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <SlideTab slide={makeSlide({ bullets: [] })} onUpdate={onUpdate} />,
    );
    expect(screen.queryByText(/要点/)).toBeNull();

    rerender(
      <SlideTab
        slide={makeSlide({
          bullets: [
            { id: "b1", text: "第一条", level: 0 },
            { id: "b2", text: "第二条", level: 0 },
          ],
        })}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByText(/要点（2条）/)).toBeTruthy();
    expect(screen.getByText("第一条")).toBeTruthy();
    expect(screen.getByText("第二条")).toBeTruthy();
  });

  it("卸载时清理未触发的防抖定时器，不再提交", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { unmount } = render(
      <SlideTab slide={makeSlide()} onUpdate={onUpdate} />,
    );
    fireEvent.change(screen.getByDisplayValue("原始标题"), {
      target: { value: "未落盘" },
    });
    unmount();
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
