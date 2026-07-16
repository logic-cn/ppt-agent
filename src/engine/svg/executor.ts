import { chat } from "@/services/llm";
import { buildSvgGenPrompt } from "@/services/llm/prompts/svg-gen";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";
import { validateSvgContract } from "./spec-contract";
import type { SvgPage } from "./types";

/** 进度回调：已完成页数、总页数 */
export type SvgProgress = (done: number, total: number) => void;

export interface GenerateSlideSvgOptions {
  specLock: SpecLock;
  plan: PagePlanItem;
  pageIndex: number;
  totalPages: number;
  signal?: AbortSignal;
}

/**
 * 生成单页「设计真相 SVG」。
 * 串行调用 chat，注入 specLock + pagePlan item，要求产出单个 <svg viewBox="0 0 1280 720">。
 * 不自动修复，仅用 validateSvgContract 兜底校验；不合规直接抛错。
 */
export async function generateSlideSvg(
  opts: GenerateSlideSvgOptions,
): Promise<string> {
  const prompt = buildSvgGenPrompt(opts);
  const res = await chat(
    {
      messages: [
        {
          role: "system",
          content:
            "你产出单页 SVG，只返回 <svg> 根元素，不要任何解释或 markdown 包裹。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      signal: opts.signal,
    },
    "svg",
  );

  const svg = res.content.match(/<svg[\s\S]*<\/svg>/i)?.[0] ?? res.content;

  const trimmed = svg.trim();
  const errors = validateSvgContract(trimmed);
  if (errors.length > 0) {
    throw new Error(
      `SVG 契约校验未通过（第 ${opts.pageIndex + 1} 页）：\n` +
        errors.map((e) => "- " + e).join("\n"),
    );
  }
  return trimmed;
}

/**
 * 逐页串行生成整份 deck 的 SVG（禁止 Promise.all 并行）。
 * 每生成一页调用一次 onProgress(done, total)。
 */
export async function generateDeckSvgs(
  plan: PagePlanItem[],
  spec: SpecLock,
  onProgress?: SvgProgress,
): Promise<SvgPage[]> {
  const total = plan.length;
  const pages: SvgPage[] = [];
  for (let i = 0; i < total; i++) {
    const svg = await generateSlideSvg({
      specLock: spec,
      plan: plan[i],
      pageIndex: i,
      totalPages: total,
    });
    pages.push({ index: i, role: plan[i].role, svg });
    onProgress?.(i + 1, total);
  }
  return pages;
}
