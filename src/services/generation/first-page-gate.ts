import type { Deck } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import type { QualityFinding } from "@/services/quality/deck-quality";
import { checkDeckQuality } from "@/services/quality/deck-quality";

const VAGUE_TOPIC_TITLE = /(概述|分析|介绍|内容|总结)$/;

/**
 * 首屏风格锚点关卡：仅在生成大纲后针对首屏做轻量级质量检查。
 * 复用全量质量检查（只跑首屏），并叠加模式专属的首屏规则，
 * 以便尽早暴露系统性风格/论点问题，避免用户在整份 deck 上反复迭代。
 */
export function runFirstPageGate(
  deck: Deck,
  design: DesignLock,
): QualityFinding[] {
  const first = deck.slides[0];
  if (!first) return [];

  // 仅对首屏做检查：剔除 deck 级规则（首屏单页无法判定），避免误报
  const DECK_WIDE_RULES = new Set(["require_closing"]);
  const findings = checkDeckQuality({ ...deck, slides: [first] }).filter(
    (f) => !DECK_WIDE_RULES.has(f.rule) && !/page_count/i.test(f.rule),
  );

  // 模式专属首屏规则：结论先行模式下首屏标题必须是结论句而非话题词
  if (
    design.mode === "pyramid" &&
    first.title &&
    VAGUE_TOPIC_TITLE.test(first.title.trim())
  ) {
    findings.push({
      rule: "pyramid_title",
      severity: "hard",
      message: "结论先行模式要求首屏标题为结论句",
      slideId: first.id,
      autoFixable: false,
    });
  }

  return findings;
}
