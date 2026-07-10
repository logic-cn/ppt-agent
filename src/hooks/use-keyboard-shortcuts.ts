import { useEffect } from "react";
import { useDeckStore } from "@/store/deck";
import { useToastStore } from "@/store/toast";

/**
 * 编辑器键盘快捷键：
 * - Ctrl+S / Cmd+S: 保存
 * - Ctrl+Z / Cmd+Z: 撤销
 * - Ctrl+Shift+Z / Cmd+Shift+Z: 重做
 */
export function useKeyboardShortcuts() {
  const persist = useDeckStore((s) => s.persist);
  const dirty = useDeckStore((s) => s.dirty);
  const deck = useDeckStore((s) => s.deck);
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const canUndo = useDeckStore((s) => s.canUndo);
  const canRedo = useDeckStore((s) => s.canRedo);

  useEffect(() => {
    if (!dirty || !deck) return;
    const timer = setInterval(() => {
      void persist();
    }, 30000);
    return () => clearInterval(timer);
  }, [dirty, deck, persist]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "s") {
        e.preventDefault();
        void persist().then(() => {
          useToastStore.getState().add({
            type: "success",
            title: "已保存",
            duration: 1500,
          });
        });
        return;
      }

      // 在输入框中不触发撤销/重做，避免与原生文本编辑冲突
      if (isInput) return;

      if (meta && e.shiftKey && e.key === "Z") {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (meta && e.key === "z") {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [persist, undo, redo, canUndo, canRedo]);
}
