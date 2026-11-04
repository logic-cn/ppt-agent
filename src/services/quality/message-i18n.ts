import { translate, type TranslationKey } from "@/services/i18n";
import type { Lang } from "@/types/preferences";
import type { QualityFinding } from "./deck-quality";
import type { SvgIssue } from "@/engine/svg/quality/checker";

/**
 * 质量诊断 code → locale key 的唯一映射表。
 *
 * 约定：code 是稳定语义 id，locale key 一律为 `quality.<code>`。
 * 新增诊断必须同时：① 在 checker/deck-quality 里带上 code + params；
 * ② 在此表登记；③ 在 zh/en 两份 locale 里补文案（测试会校验齐全）。
 *
 * 中文规范文案（issue.message）始终保留：它同时用于 LLM 重画回喂
 * （端侧 MiniCPM5 是中文模型，反馈切英文会掉修复质量）与本地化兜底。
 */
export const QUALITY_MESSAGE_KEYS: Record<string, TranslationKey> = {
  // ---- SVG 契约 ----
  "svg.contractMissingRoot": "quality.svg.contractMissingRoot",
  "svg.contractMissingViewBox": "quality.svg.contractMissingViewBox",
  "svg.contractBadViewBox": "quality.svg.contractBadViewBox",
  "svg.contractForbiddenElement": "quality.svg.contractForbiddenElement",
  "svg.contractUnsupportedElement": "quality.svg.contractUnsupportedElement",
  "svg.contractExternalRef": "quality.svg.contractExternalRef",
  // ---- 几何与文本 ----
  "svg.textOutOfBounds": "quality.svg.textOutOfBounds",
  "svg.textBelowCanvas": "quality.svg.textBelowCanvas",
  "svg.textSizeBudget": "quality.svg.textSizeBudget",
  "svg.textRightOutsideSafe": "quality.svg.textRightOutsideSafe",
  "svg.textLeftOutsideSafe": "quality.svg.textLeftOutsideSafe",
  "svg.textBottomOutsideSafe": "quality.svg.textBottomOutsideSafe",
  "svg.textOverlap": "quality.svg.textOverlap",
  "svg.elementLeftOut": "quality.svg.elementLeftOut",
  "svg.elementTopOut": "quality.svg.elementTopOut",
  "svg.elementRightOut": "quality.svg.elementRightOut",
  "svg.elementBottomOut": "quality.svg.elementBottomOut",
  "svg.typographyOffAnchor": "quality.svg.typographyOffAnchor",
  // ---- 图表 ----
  "svg.chartInvalidType": "quality.svg.chartInvalidType",
  "svg.chartMissingData": "quality.svg.chartMissingData",
  "svg.chartInvalidJson": "quality.svg.chartInvalidJson",
  "svg.chartEmptyData": "quality.svg.chartEmptyData",
  "svg.chartMissingMarker": "quality.svg.chartMissingMarker",
  "svg.chartBarCountMismatch": "quality.svg.chartBarCountMismatch",
  "svg.chartBarRatioMismatch": "quality.svg.chartBarRatioMismatch",
  // ---- 颜色值合法性 ----
  "svg.colorInvalidValue": "quality.svg.colorInvalidValue",
  // ---- 内容必现性 ----
  "svg.contentMissingTitle": "quality.svg.contentMissingTitle",
  "svg.contentMissingBullet": "quality.svg.contentMissingBullet",
  "svg.contentMissingSnippet": "quality.svg.contentMissingSnippet",
  // ---- 词表与一致性门 ----
  "svg.cohortColorOffLock": "quality.svg.cohortColorOffLock",
  "svg.cohortFontOffLock": "quality.svg.cohortFontOffLock",
  "svg.shapeInvalidPreset": "quality.svg.shapeInvalidPreset",
  "svg.iconUnknown": "quality.svg.iconUnknown",
  // ---- 量化美学 ----
  "svg.aestheticsBrandContrast": "quality.svg.aestheticsBrandContrast",
  "svg.aestheticsLowContrast": "quality.svg.aestheticsLowContrast",
  "svg.aestheticsAccentArea": "quality.svg.aestheticsAccentArea",
  "svg.aestheticsMissingBackground": "quality.svg.aestheticsMissingBackground",
  "svg.aestheticsShadowOpacity": "quality.svg.aestheticsShadowOpacity",
  "svg.aestheticsPaletteContrast": "quality.svg.aestheticsPaletteContrast",
  // ---- 版面与节奏 ----
  "svg.balanceBottomGap": "quality.svg.balanceBottomGap",
  "svg.balanceLeftAlignment": "quality.svg.balanceLeftAlignment",
  "svg.rhythmCjkLetterSpacing": "quality.svg.rhythmCjkLetterSpacing",
  "svg.rhythmLeftDrift": "quality.svg.rhythmLeftDrift",
  "svg.rhythmGridSpacing": "quality.svg.rhythmGridSpacing",
  // ---- deck 级结构规则 ----
  "deck.missingCover": "quality.deck.missingCover",
  "deck.missingClosing": "quality.deck.missingClosing",
  "deck.duplicateTitle": "quality.deck.duplicateTitle",
  "deck.tooManyBullets": "quality.deck.tooManyBullets",
  "deck.emptyChart": "quality.deck.emptyChart",
  "deck.missingImage": "quality.deck.missingImage",
  "deck.twoColumnIncomplete": "quality.deck.twoColumnIncomplete",
  "deck.genericTitle": "quality.deck.genericTitle",
  "deck.chartUnverified": "quality.deck.chartUnverified",
  "deck.chartSampleData": "quality.deck.chartSampleData",
  "deck.notesMissing": "quality.deck.notesMissing",
  "deck.pageCountMismatch": "quality.deck.pageCountMismatch",
  "deck.templateNeedsChart": "quality.deck.templateNeedsChart",
  "deck.pyramidTitle": "quality.deck.pyramidTitle",
};

/** code → locale key；未登记的 code 返回 undefined（调用方回落中文文案） */
export function qualityMessageKey(code?: string): TranslationKey | undefined {
  if (!code) return undefined;
  return QUALITY_MESSAGE_KEYS[code];
}

/** 本地化一条 SVG 层诊断（无法本地化时回落中文规范文案） */
export function localizeSvgIssue(issue: SvgIssue, lang: Lang): string {
  const key = qualityMessageKey(issue.code);
  if (!key) return issue.message;
  return translate(lang, key, issue.params);
}

/**
 * 本地化一条质量检查项：页面前缀 + 详情。
 *
 * 页面前缀单独渲染（`第 N 页「title」：` / `Page N "title": `），
 * 因此中文规范文案里不再内嵌前缀。
 */
export function localizeFinding(finding: QualityFinding, lang: Lang): string {
  const key = qualityMessageKey(finding.code);
  const detail = key ? translate(lang, key, finding.params) : finding.message;
  if (!finding.page) return detail;
  const prefix = translate(lang, "quality.pageContext", {
    index: finding.page.index,
    title: finding.page.title,
  });
  return `${prefix} ${detail}`;
}
