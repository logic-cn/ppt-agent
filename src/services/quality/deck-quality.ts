import type { Deck } from "@/types/deck";
import type { AutoFixAction } from "./types";
import { buildSpecLock } from "@/design/spec-lock";
import {
  checkSvg,
  checkTextGeometry,
  checkAesthetics,
  checkChartGeometry,
  checkLayoutBalance,
  checkVisualRhythm,
  checkPaletteContrast,
} from "@/engine/svg/quality/checker";

export type Severity = "hard" | "soft";

export interface QualityFinding {
  rule: string;
  severity: Severity;
  /**
   * 中文规范文案（不含页面前缀）：界面本地化走 code + params，
   * 无法本地化时回落此文案。
   */
  message: string;
  /** 稳定语义 id，对应 locale key `quality.<code>` */
  code?: string;
  /** 本地化插值参数 */
  params?: Record<string, string | number>;
  /** 页面前缀来源（页码 + 页标题） */
  page?: { index: number; title: string };
  slideId?: string;
  autoFixable: boolean;
}

export interface QualityCheckOptions {
  pageCount?: number;
  /** 模板推荐的额外质量规则，如 require_cover / require_charts */
  rules?: string[];
  /** 来源原文（导入生成场景）：提供时对图表数据做事实校准（B4） */
  sourceText?: string;
  /** 跳过 SVG 层校验（纯大纲态/首屏门等无设计真相 SVG 或不宜阻断的场景） */
  skipSvgChecks?: boolean;
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

function checkMissingCover(deck: Deck): QualityFinding[] {
  if (deck.slides.length === 0) return [];
  const first = deck.slides[0];
  if (first.layout !== "cover" || !first.title.trim()) {
    return [
      {
        rule: "require_cover",
        severity: "hard",
        slideId: first.id,
        message: "第一页不是封面布局或标题为空",
        code: "deck.missingCover",
        autoFixable: false,
      },
    ];
  }
  return [];
}

function checkMissingClosing(deck: Deck): QualityFinding[] {
  if (deck.slides.length === 0) return [];
  const last = deck.slides[deck.slides.length - 1];
  if (last.layout !== "closing") {
    return [
      {
        rule: "require_closing",
        severity: "hard",
        slideId: last.id,
        message: "最后一页不是结尾布局",
        code: "deck.missingClosing",
        autoFixable: false,
      },
    ];
  }
  return [];
}

function checkDuplicateTitles(deck: Deck): QualityFinding[] {
  const findings: QualityFinding[] = [];
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
        findings.push({
          rule: "duplicate_title",
          severity: "soft",
          slideId: deck.slides[idx].id,
          message: `标题「${deck.slides[idx].title}」与其他页面重复`,
          code: "deck.duplicateTitle",
          params: { title: deck.slides[idx].title },
          autoFixable: false,
        });
      }
    }
  }
  return findings;
}

function checkTooManyBullets(deck: Deck): QualityFinding[] {
  const findings: QualityFinding[] = [];
  for (const slide of deck.slides) {
    if (slide.bullets && slide.bullets.length > 7) {
      findings.push({
        rule: "bullets_too_many",
        severity: "soft",
        slideId: slide.id,
        message: `页面「${slide.title}」一级要点超过 7 条（共 ${slide.bullets.length} 条）`,
        code: "deck.tooManyBullets",
        params: { title: slide.title, count: slide.bullets.length },
        autoFixable: true,
      });
    }
  }
  return findings;
}

function checkEmptyChart(deck: Deck): QualityFinding[] {
  const findings: QualityFinding[] = [];
  for (const slide of deck.slides) {
    if (slide.layout === "chart" || slide.chart) {
      if (!slide.chart || slide.chart.data.length === 0) {
        findings.push({
          rule: "empty_chart",
          severity: "hard",
          slideId: slide.id,
          message: `页面「${slide.title}」图表无数据`,
          code: "deck.emptyChart",
          params: { title: slide.title },
          autoFixable: false,
        });
      }
    }
  }
  return findings;
}

function checkLayoutContentMismatch(deck: Deck): QualityFinding[] {
  const findings: QualityFinding[] = [];
  for (const slide of deck.slides) {
    if (slide.layout === "image" && !slide.image) {
      findings.push({
        rule: "layout_content_mismatch",
        severity: "soft",
        slideId: slide.id,
        message: `页面「${slide.title}」布局为配图但未配置图片`,
        code: "deck.missingImage",
        params: { title: slide.title },
        autoFixable: false,
      });
    }
    if (
      slide.layout === "two-column" &&
      (!slide.items || slide.items.length < 2)
    ) {
      findings.push({
        rule: "layout_content_mismatch",
        severity: "soft",
        slideId: slide.id,
        message: `页面「${slide.title}」布局为双栏但不足两栏内容`,
        code: "deck.twoColumnIncomplete",
        params: { title: slide.title },
        autoFixable: false,
      });
    }
  }
  return findings;
}

function checkGenericTitle(deck: Deck): QualityFinding[] {
  const findings: QualityFinding[] = [];
  for (const slide of deck.slides) {
    if (GENERIC_TITLES.has(slide.title.trim()) && !slide.subtitle) {
      findings.push({
        rule: "vague_title",
        severity: "soft",
        slideId: slide.id,
        message: `页面「${slide.title}」标题较为空泛，建议添加副标题或更具体的标题`,
        code: "deck.genericTitle",
        params: { title: slide.title },
        autoFixable: false,
      });
    }
  }
  return findings;
}

// ---- 图表事实校准（B4，参照 PPT Master verify-charts）----

/** 提取 slide SVG 中全部 data-chart-data 的数值（label/value 点集） */
export function extractChartValues(svg: string): number[] {
  const values: number[] = [];
  const re = /<g\b[^>]*\bdata-chart-data\s*=\s*(['"])([\s\S]*?)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    try {
      const points: unknown = JSON.parse(m[2]);
      if (Array.isArray(points)) {
        for (const p of points) {
          const v = (p as { value?: unknown })?.value;
          if (typeof v === "number" && Number.isFinite(v)) values.push(v);
        }
      }
    } catch {
      // 数据损坏由 checker.checkChartData 在生成端拦截，这里跳过
    }
  }
  return values;
}

/** 来源文本是否包含该数值（容忍千分位逗号/中文逗号/空白干扰与尾零精度） */
function sourceIncludesNumber(sourceText: string, value: number): boolean {
  const normalized = sourceText.replace(/[,，\s]/g, "");
  const candidates = [
    String(value),
    // 18.0 → 18；1234.50 → 1234.5
    String(Number(value.toFixed(2))),
    String(Math.round(value)),
  ];
  return candidates.some((c) => normalized.includes(c));
}

/**
 * 图表事实校准：导入生成场景下，校验图表数值是否能在来源材料中找到。
 * 找不到的数值不阻断导出，但以 soft 项提示用户核对（防 LLM 编数据）。
 */
function checkChartFacts(
  deck: Deck,
  options?: QualityCheckOptions,
): QualityFinding[] {
  const sourceText = options?.sourceText;
  if (!sourceText) return [];
  const findings: QualityFinding[] = [];
  for (const slide of deck.slides) {
    if (!slide.svg) continue;
    const values = extractChartValues(slide.svg);
    if (values.length === 0) continue;
    const unverified = values.filter(
      (v) => !sourceIncludesNumber(sourceText, v),
    );
    if (unverified.length === 0) continue;
    findings.push({
      rule: "chart_data_unverified",
      severity: "soft",
      slideId: slide.id,
      message: `页面「${slide.title}」图表数值 ${unverified
        .slice(0, 4)
        .join("、")} 未在来源材料中找到，请核对是否为编造数据`,
      code: "deck.chartUnverified",
      params: { title: slide.title, values: unverified.slice(0, 4).join("、") },
      autoFixable: false,
    });
  }
  return findings;
}

function checkPageCount(
  deck: Deck,
  options?: QualityCheckOptions,
): QualityFinding[] {
  if (!options?.pageCount) return [];
  const diff = Math.abs(deck.slides.length - options.pageCount);
  if (diff > 2) {
    return [
      {
        rule: "page_count_mismatch",
        severity: "soft",
        message: `期望 ${options.pageCount} 页，实际 ${deck.slides.length} 页（偏差 ${diff} 页）`,
        code: "deck.pageCountMismatch",
        params: {
          expected: options.pageCount,
          actual: deck.slides.length,
          diff,
        },
        autoFixable: false,
      },
    ];
  }
  return [];
}

/**
 * SVG 层校验（导出锁，参照 PPT Master export lock）：
 * 设计真相 SVG 存在阻断级几何/图表问题 → hard（拒绝对该 deck 导出）；
 * 色彩比例/阴影/节奏统计/版面失衡 → soft（质量面板提示，不阻断）。
 * 对比度问题分级处置（对标 brand escalation）：
 *  - 先做一次色板 token 组合静态体检（checkPaletteContrast）出 deck 级单条；
 *  - 逐页 checkAesthetics 里 kind==="brand"（两端都是 token）塌陷折叠为一条，
 *    避免同一组合在每页重复报错；kind==="page"（单页越位用色）仍逐页报。
 * 无 svg 的 deck（纯大纲态）自然跳过。
 */
export function checkSvgFindings(deck: Deck): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const spec = buildSpecLock(deck.design);
  const push = (
    it: {
      severity: "error" | "warn";
      message: string;
      code?: string;
      params?: Record<string, string | number>;
      kind?: string;
    },
    rule: string,
    slideId?: string,
    page?: { index: number; title: string },
  ) =>
    findings.push({
      rule,
      severity: it.severity === "error" ? "hard" : "soft",
      slideId,
      message: it.message,
      code: it.code,
      params: it.params,
      page,
      autoFixable: false,
    });

  // deck 级：色板 token 组合本身不达标（与逐页 brand 塌陷同源，去重前置）
  const brandPairs = new Set<string>();
  for (const it of checkPaletteContrast(spec)) {
    findings.push({
      rule: "svg_palette",
      severity: "soft",
      message: it.message,
      code: it.code,
      params: it.params,
      autoFixable: false,
    });
    const m = it.message.match(/#([0-9a-fA-F]{3,6}).*?#([0-9a-fA-F]{3,6})/);
    if (m) brandPairs.add(m[1].toUpperCase() + "/" + m[2].toUpperCase());
  }

  deck.slides.forEach((slide, i) => {
    if (!slide.svg) return;
    // 页面前缀独立成字段：界面按当前语言渲染，中文规范文案不再内嵌前缀
    const page = { index: i + 1, title: slide.title };
    const groups: {
      issues: {
        severity: "error" | "warn";
        message: string;
        code?: string;
        params?: Record<string, string | number>;
        kind?: string;
      }[];
      rule: string;
    }[] = [
      { issues: checkSvg(slide.svg, spec), rule: "svg_contract" },
      { issues: checkTextGeometry(slide.svg, spec), rule: "svg_geometry" },
      { issues: checkAesthetics(slide.svg, spec), rule: "svg_aesthetics" },
      { issues: checkChartGeometry(slide.svg), rule: "svg_chart" },
      { issues: checkLayoutBalance(slide.svg, spec), rule: "svg_balance" },
      { issues: checkVisualRhythm(slide.svg, spec), rule: "svg_rhythm" },
    ];
    for (const g of groups) {
      for (const it of g.issues) {
        // brand 级对比度塌陷：整份 deck 系统问题，已由 deck 级/首个页级代表，
        // 同一 token 组合不在每页重复。
        if (it.kind === "brand") {
          const m = it.message.match(
            /#([0-9a-fA-F]{3,6}).*?#([0-9a-fA-F]{3,6})/,
          );
          const key = m
            ? m[1].toUpperCase() + "/" + m[2].toUpperCase()
            : it.message;
          if (brandPairs.has(key)) continue;
          brandPairs.add(key);
          push(it, "svg_brand", slide.id, page);
          continue;
        }
        push(it, g.rule, slide.id, page);
      }
    }
  });
  return findings;
}

/**
 * 对 deck 做全量质量检查，返回分级后的检查项列表。
 * severity 为 "hard"（结构性，阻断导出）或 "soft"（提示性，可自动修复）。
 */
export function checkDeckQuality(
  deck: Deck,
  options?: QualityCheckOptions,
): QualityFinding[] {
  const findings: QualityFinding[] = [];

  findings.push(...checkMissingCover(deck));
  findings.push(...checkMissingClosing(deck));
  findings.push(...checkDuplicateTitles(deck));
  findings.push(...checkTooManyBullets(deck));
  findings.push(...checkEmptyChart(deck));
  findings.push(...checkLayoutContentMismatch(deck));
  findings.push(...checkGenericTitle(deck));
  findings.push(...checkPageCount(deck, options));
  findings.push(...checkChartFacts(deck, options));
  if (!options?.skipSvgChecks) {
    findings.push(...checkSvgFindings(deck));
  }

  // 模板推荐的额外质量规则
  const rules = options?.rules ?? [];
  const has = (rule: string) => findings.some((f) => f.rule === rule);

  if (rules.includes("require_charts") && !has("chart_required")) {
    const hasChart = deck.slides.some((s) => s.layout === "chart" || s.chart);
    if (!hasChart) {
      findings.push({
        rule: "chart_required",
        severity: "hard",
        message: "该模板要求至少包含一个图表页",
        code: "deck.templateNeedsChart",
        autoFixable: false,
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
        findings.push({
          rule: "empty_chart",
          severity: "hard",
          slideId: slide.id,
          message: `页面「${slide.title}」图表无数据`,
          code: "deck.emptyChart",
          params: { title: slide.title },
          autoFixable: false,
        });
      }
    }
  }

  return findings;
}

/** 是否存在阻断导出的 hard 级检查项 */
export function hasHardError(findings: QualityFinding[]): boolean {
  return findings.some((f) => f.severity === "hard");
}

/** 根据检查项推导质量分（0-100） */
export function qualityScore(findings: QualityFinding[]): number {
  const hard = findings.filter((f) => f.severity === "hard").length;
  const soft = findings.filter((f) => f.severity === "soft").length;
  const score = 100 - hard * 15 - soft * 6;
  return Math.max(0, Math.min(100, score));
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
