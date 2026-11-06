import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PresetPickerDialog } from "./PresetPickerDialog";

describe("PresetPickerDialog 焦点与关闭", () => {
  it("打开时焦点进入弹窗，关闭后归还触发元素", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button>打开模板</button>
        <PresetPickerDialog
          open={false}
          onClose={onClose}
          onGenerate={vi.fn()}
        />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "打开模板" });
    trigger.focus();

    rerender(
      <>
        <button>打开模板</button>
        <PresetPickerDialog open onClose={onClose} onGenerate={vi.fn()} />
      </>,
    );

    const dialog = screen.getByRole("dialog");
    const panel = dialog.querySelector<HTMLElement>('[tabindex="-1"]')!;
    await waitFor(() => expect(document.activeElement).toBe(panel));

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // 父组件真正关闭后，焦点应回到触发按钮
    rerender(
      <>
        <button>打开模板</button>
        <PresetPickerDialog
          open={false}
          onClose={onClose}
          onGenerate={vi.fn()}
        />
      </>,
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("Escape 关闭弹窗", () => {
    const onClose = vi.fn();
    render(<PresetPickerDialog open onClose={onClose} onGenerate={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
