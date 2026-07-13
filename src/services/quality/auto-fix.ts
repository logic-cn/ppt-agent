import type { Deck, Slide } from "@/types/deck";
import type { QualityFinding } from "./deck-quality";

const MAX_BULLETS = 7;

/** 取出阻断导出的 hard 级检查项，供 UI 阻断导出 / 提示重生成 */
export function getHardFindings(findings: QualityFinding[]): QualityFinding[] {
  return findings.filter((f) => f.severity === "hard");
}

/**
 * 应用自动修复：仅针对「soft 且 autoFixable」的检查项，绝不触碰 hard 问题，
 * 避免自动修复掩盖结构性错误。返回一份新的 Deck（不修改入参）。
 *
 * 目前已知的 soft+autoFixable 规则：bullets_too_many → 一级要点裁剪到 7 条。
 */
export function applyAutoFixes(deck: Deck, findings: QualityFinding[]): Deck {
  const fixable = findings.filter(
    (f) => f.severity === "soft" && f.autoFixable,
  );
  if (fixable.length === 0) return deck;

  const fixableIds = new Set(
    fixable.filter((f) => f.slideId).map((f) => f.slideId as string),
  );

  let changed = false;
  const slides: Slide[] = deck.slides.map((s) => {
    if (!fixableIds.has(s.id) || !s.bullets) return s;
    if (s.bullets.length <= MAX_BULLETS) return s;
    changed = true;
    return { ...s, bullets: s.bullets.slice(0, MAX_BULLETS) };
  });

  if (!changed) return deck;
  return { ...deck, slides, updatedAt: Date.now() };
}
