import type { Deck, Slide } from "@/types/deck";
import type { AutoFixAction } from "./types";
import type { QualityFinding } from "./deck-quality";

const MAX_BULLETS = 7;
const PLACEHOLDER_TITLE = "未命名页面";
const CLOSING_TITLE = "谢谢观看";

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
    // 裁剪要点即编辑了 SVG 视觉字段：已有 SVG 标记过期
    return {
      ...s,
      bullets: s.bullets.slice(0, MAX_BULLETS),
      ...(s.svg ? { svgStale: true } : {}),
    };
  });

  if (!changed) return deck;
  return { ...deck, slides, updatedAt: Date.now() };
}

/** 该 slide 是否已被动作覆盖（避免重复应用同页多个动作） */
function touchSlide(
  s: Slide,
  actions: AutoFixAction[],
  touched: Set<string>,
): Slide {
  const acts = actions.filter((a) => a.slideId === s.id);
  if (acts.length === 0) return s;

  let next = s;
  for (const act of acts) {
    switch (act.type) {
      case "set_title":
        if (!next.title.trim()) {
          next = { ...next, title: PLACEHOLDER_TITLE };
          touched.add(s.id);
        }
        break;
      case "remove_empty_bullet":
        if (next.bullets && next.bullets.some((b) => !b.text.trim())) {
          next = {
            ...next,
            bullets: next.bullets.filter((b) => b.text.trim()),
          };
          touched.add(s.id);
        }
        break;
      case "change_layout":
        if (
          next.layout === "chart" &&
          (!next.chart || next.chart.data.length === 0)
        ) {
          const { chart: _dropped, ...rest } = next;
          next = { ...rest, layout: "content" };
          touched.add(s.id);
        }
        break;
    }
  }
  // 该页被结构性修改且已有 SVG → 标记过期（编辑了视觉字段）
  if (touched.has(s.id) && s.svg && next.svgStale !== true) {
    next = { ...next, svgStale: true };
  }
  return next;
}

/**
 * 应用 generateAutoFixes 生成的动作列表（set_title / remove_empty_bullet /
 * change_layout / append_closing）。返回新 Deck（不修改入参）；
 * 无任何实际变更时原样返回原引用。
 */
export function applyAutoFixActions(
  deck: Deck,
  actions: AutoFixAction[],
): Deck {
  if (actions.length === 0) return deck;

  const touched = new Set<string>();
  const slides: Slide[] = deck.slides.map((s) =>
    touchSlide(s, actions, touched),
  );

  if (actions.some((a) => a.type === "append_closing")) {
    const last = slides[slides.length - 1];
    if (!last || last.layout !== "closing") {
      slides.push({
        id: crypto.randomUUID(),
        layout: "closing",
        title: CLOSING_TITLE,
      });
      touched.add("__append_closing__");
    }
  }

  if (touched.size === 0) return deck;
  return { ...deck, slides, updatedAt: Date.now() };
}
