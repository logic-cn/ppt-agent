import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { useDeckStore } from "@/store/deck";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

describe("useKeyboardShortcuts", () => {
  const original = useDeckStore.getState();

  afterEach(() => {
    useDeckStore.setState(original, true);
  });

  it("Cmd/Ctrl+Shift+Z 执行重做，而不是再次撤销", () => {
    const undo = vi.fn();
    const redo = vi.fn();
    useDeckStore.setState({
      deck: null,
      dirty: false,
      canUndo: true,
      canRedo: true,
      undo,
      redo,
    });

    renderHook(() => useKeyboardShortcuts());
    // 部分 WebView/键盘布局下 Shift+Z 的 e.key 仍为小写 "z"
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });

    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });
});
