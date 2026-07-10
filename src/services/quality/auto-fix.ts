import type { Deck, Slide } from "@/types/deck";
import type { AutoFixAction } from "./types";
import { generateAutoFixes } from "./deck-quality";

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `sl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 递归清理 bullet：仅当“无文本且无可保留的子项”时才删除，
 * 带 children 的父 bullet 即使文本为空也保留，避免误删内容。
 */
function cleanBullets<T extends { text: string; children?: T[] }>(
  bullets: T[],
): T[] {
  return bullets
    .map((b) => {
      const children = b.children ? cleanBullets(b.children) : undefined;
      return children ? { ...b, children } : b;
    })
    .filter((b) => b.text.trim() || (b.children && b.children.length > 0));
}

/**
 * 确定性地应用自动修复动作，返回一份新的 Deck（不修改原数据）。
 * 若不传入 actions，则基于当前 deck 重新推导修复项。
 */
export function applyAutoFixes(deck: Deck, actions?: AutoFixAction[]): Deck {
  const fixes =
    actions && actions.length > 0 ? actions : generateAutoFixes(deck);
  if (fixes.length === 0) return deck;

  let slides: Slide[] = deck.slides.map((s) => ({ ...s }));
  let appendedClosing = false;

  for (const action of fixes) {
    switch (action.type) {
      case "set_title":
        slides = slides.map((s) =>
          s.id === action.slideId && !s.title.trim()
            ? { ...s, title: "未命名页面" }
            : s,
        );
        break;
      case "remove_empty_bullet":
        slides = slides.map((s) =>
          s.id === action.slideId && s.bullets
            ? { ...s, bullets: cleanBullets(s.bullets) }
            : s,
        );
        break;
      case "change_layout":
        slides = slides.map((s) =>
          s.id === action.slideId
            ? { ...s, layout: "content", chart: undefined }
            : s,
        );
        break;
      case "append_closing":
        if (!appendedClosing && !slides.some((s) => s.layout === "closing")) {
          slides = [
            ...slides,
            { id: createId(), layout: "closing", title: "谢谢观看" },
          ];
          appendedClosing = true;
        }
        break;
    }
  }

  return { ...deck, slides, updatedAt: Date.now() };
}
