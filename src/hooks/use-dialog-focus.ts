import { useEffect, type RefObject } from "react";

/**
 * 对话框焦点管理：打开时焦点移入（默认聚焦取消/中性按钮，危险按钮
 * 不自动聚焦——Enter 即破坏性操作是误删事故的常见来源）、Tab 循环
 * 困在对话框内、关闭时把焦点还给触发元素。
 *
 * @param open          对话框是否打开
 * @param containerRef  对话框容器（含 role="dialog" 的元素）
 * @param initialFocusRef 打开时聚焦的元素（推荐传「取消」按钮）
 */
export function useDialogFocus(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    // 记录触发元素，关闭时归还焦点
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 焦点移入：优先指定元素，否则第一个可聚焦元素
    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );

    (initialFocusRef?.current ?? focusables()[0])?.focus();

    // Tab 循环困在对话框内
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeyDown);

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, containerRef, initialFocusRef]);
}
