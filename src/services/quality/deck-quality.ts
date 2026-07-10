import type { Deck } from "@/types/deck";
import type {
  DeckQualityReport,
  DeckQualityIssue,
  AutoFixAction,
} from "./types";

export interface GenerationOptions {
  pageCount?: number;
  /** 模板推荐的额外质量规则，如 require_cover / require_charts */
  rules?: string[];
}

/** 模板可声明的质量规则名 */
export const TEMPLATE_QUALITY_RULES = [
  "require_cover",
  "require_closing",
  "require_charts",
  "require_data",
] as const;

export type TemplateQualityRule = (typeof TEMPLATE_QUALITY_RULES)[number];

const GENERIC_TITLES = new Set([
  "概述",
  "介绍",
  "总结",
  "分析",
  "引言",
  "背景",
  "目标",
  "概况",
  "前言",
]);

function checkMissingCover(deck: Deck): DeckQualityIssue | null {
  if (deck.slides.length === 0) return null;
  const first = deck.slides[0];
  if (first.layout !== "cover" || !first.title.trim()) {
    return {
      severity: "error",
      slideId: first.id,
      code: "missing_cover",
      message: "第一页不是封面布局或标题为空",
    };
  }
  return null;
}

function checkMissingClosing(deck: Deck): DeckQualityIssue | null {
  if (deck.slides.length === 0) return null;
  const last = deck.slides[deck.slides.length - 1];
  if (last.layout !== "closing") {
    return {
      severity: "warning",
      slideId: last.id,
      code: "missing_closing",
      message: "最后一页不是结尾布局",
    };
  }
  return null;
}

function checkDuplicateTitles(deck: Deck): DeckQualityIssue[] {
  const issues: DeckQualityIssue[] = [];
  const seen = new Map<string, number[]>();
  deck.slides.forEach((slide, index) => {
    const title = slide.title.trim().toLowerCase();
    if (!title) return;
    if (seen.has(title)) {
      seen.get(title)!.push(index);
    } else {
      seen.set(title, [index]);
    }
  });
  for (const [, indices] of seen) {
    if (indices.length > 1) {
      for (const idx of indices) {
        issues.push({
          severity: "warning",
          slideId: deck.slides[idx].id,
          code: "duplicate_title",
          message: `标题「${deck.slides[idx].title}」与其他页面重复`,
        });
      }
    }
  }
  return issues;
}

function checkTooManyBullets(deck: Deck): DeckQualityIssue[] {
  const issues: DeckQualityIssue[] = [];
  for (const slide of deck.slides) {
    if (slide.bullets && slide.bullets.length > 7) {
      issues.push({
        severity: "warning",
        slideId: slide.id,
        code: "too_many_bullets",
        message: `页面「${slide.title}」一级要点超过 7 条（共 ${slide.bullets.length} 条）`,
      });
    }
  }
  return issues;
}

function checkEmptyChart(deck: Deck): DeckQualityIssue[] {
  const issues: DeckQualityIssue[] = [];
  for (const slide of deck.slides) {
    if (slide.layout === "chart" || slide.chart) {
      if (!slide.chart || slide.chart.data.length === 0) {
        issues.push({
          severity: "error",
          slideId: slide.id,
          code: "empty_chart",
          message: `页面「${slide.title}」图表无数据`,
        });
      }
    }
  }
  return issues;
}

function checkLayoutContentMismatch(deck: Deck): DeckQualityIssue[] {
  const issues: DeckQualityIssue[] = [];
  for (const slide of deck.slides) {
    if (slide.layout === "image" && !slide.image) {
      issues.push({
        severity: "warning",
        slideId: slide.id,
        code: "layout_content_mismatch",
        message: `页面「${slide.title}」布局为配图但未配置图片`,
      });
    }
    if (
      slide.layout === "two-column" &&
      (!slide.items || slide.items.length < 2)
    ) {
      issues.push({
        severity: "warning",
        slideId: slide.id,
        code: "layout_content_mismatch",
        message: `页面「${slide.title}」布局为双栏但不足两栏内容`,
      });
    }
  }
  return issues;
}

function checkGenericTitle(deck: Deck): DeckQualityIssue[] {
  const issues: DeckQualityIssue[] = [];
  for (const slide of deck.slides) {
    if (GENERIC_TITLES.has(slide.title.trim()) && !slide.subtitle) {
      issues.push({
        severity: "info",
        slideId: slide.id,
        code: "title_too_generic",
        message: `页面「${slide.title}」标题较为空泛，建议添加副标题或更具体的标题`,
      });
    }
  }
  return issues;
}

function checkPageCount(
  deck: Deck,
  options?: GenerationOptions,
): DeckQualityIssue | null {
  if (!options?.pageCount) return null;
  const diff = Math.abs(deck.slides.length - options.pageCount);
  if (diff > 2) {
    return {
      severity: "info",
      code: "page_count_mismatch",
      message: `期望 ${options.pageCount} 页，实际 ${deck.slides.length} 页（偏差 ${diff} 页）`,
    };
  }
  return null;
}

export function checkDeckQuality(
  deck: Deck,
  options?: GenerationOptions,
): DeckQualityReport {
  const issues: DeckQualityIssue[] = [];

  const cover = checkMissingCover(deck);
  if (cover) issues.push(cover);

  const closing = checkMissingClosing(deck);
  if (closing) issues.push(closing);

  issues.push(...checkDuplicateTitles(deck));
  issues.push(...checkTooManyBullets(deck));
  issues.push(...checkEmptyChart(deck));
  issues.push(...checkLayoutContentMismatch(deck));
  issues.push(...checkGenericTitle(deck));

  const pageCount = checkPageCount(deck, options);
  if (pageCount) issues.push(pageCount);

  // 模板推荐的额外质量规则
  const rules = options?.rules ?? [];
  const has = (code: string) => issues.some((i) => i.code === code);

  if (rules.includes("require_charts") && !has("chart_required")) {
    const hasChart = deck.slides.some((s) => s.layout === "chart" || s.chart);
    if (!hasChart) {
      issues.push({
        severity: "warning",
        code: "chart_required",
        message: "该模板要求至少包含一个图表页",
      });
    }
  }
  if (rules.includes("require_data")) {
    for (const slide of deck.slides) {
      if (
        (slide.layout === "chart" || slide.chart) &&
        (!slide.chart || slide.chart.data.length === 0) &&
        !has("empty_chart")
      ) {
        issues.push({
          severity: "error",
          slideId: slide.id,
          code: "empty_chart",
          message: `页面「${slide.title}」图表无数据`,
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  let score = 100;
  score -= errorCount * 15;
  score -= warningCount * 6;
  score -= infoCount * 2;
  score = Math.max(0, Math.min(100, score));

  const suggestions = issues.map((i) => i.message);

  return { score, issues, suggestions };
}

export function generateAutoFixes(deck: Deck): AutoFixAction[] {
  const actions: AutoFixAction[] = [];

  for (const slide of deck.slides) {
    if (!slide.title.trim()) {
      actions.push({
        type: "set_title",
        slideId: slide.id,
        description: `为空白标题页生成占位标题`,
      });
    }
    if (slide.bullets) {
      const emptyBullets = slide.bullets.filter((b) => !b.text.trim());
      if (emptyBullets.length > 0) {
        actions.push({
          type: "remove_empty_bullet",
          slideId: slide.id,
          description: `删除页面「${slide.title}」中的空要点`,
        });
      }
    }
    if (
      slide.layout === "chart" &&
      (!slide.chart || slide.chart.data.length === 0)
    ) {
      actions.push({
        type: "change_layout",
        slideId: slide.id,
        description: `将无数据的图表页「${slide.title}」改为正文布局`,
      });
    }
  }

  if (deck.slides.length > 0) {
    const last = deck.slides[deck.slides.length - 1];
    if (last.layout !== "closing") {
      actions.push({
        type: "append_closing",
        description: "追加一页结尾页",
      });
    }
  }

  return actions;
}
