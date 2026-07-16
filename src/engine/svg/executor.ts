import { chat } from "@/services/llm";
import { buildSvgGenPrompt } from "@/services/llm/prompts/svg-gen";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";
import { validateSvgContract } from "./spec-contract";
import { checkSvg } from "./quality/checker";
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
 * 集成质量闸门：首轮产出后若 checkSvg 报 error，则把问题回喂 chat 重画，最多 2 轮。
 * 循环结束后仍以 validateSvgContract 兜底，避免返回非法 svg（最后防线）。
 */
export async function generateSlideSvg(
  opts: GenerateSlideSvgOptions,
): Promise<string> {
  const prompt = buildSvgGenPrompt(opts);

  const rawGenerate = async (userContent: string): Promise<string> => {
    const res = await chat(
      {
        messages: [
          {
            role: "system",
            content:
              "你产出单页 SVG，只返回 <svg> 根元素，不要任何解释或 markdown 包裹。",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        signal: opts.signal,
      },
      "svg",
    );
    return res.content.match(/<svg[\s\S]*<\/svg>/i)?.[0] ?? res.content;
  };

  let svg = (await rawGenerate(prompt)).trim();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const issues = checkSvg(svg, opts.specLock).filter(
      (i) => i.severity === "error",
    );
    if (issues.length === 0) break;
    const feedback =
      "你的 SVG 有以下问题，请修正后重新输出完整 SVG：\n" +
      issues.map((i) => "- " + i.message).join("\n");
    svg = (await rawGenerate(prompt + "\n\n" + feedback)).trim();
  }

  const errors = validateSvgContract(svg);
  if (errors.length > 0) {
    throw new Error(
      `SVG 契约校验未通过（第 ${opts.pageIndex + 1} 页）：\n` +
        errors.map((e) => "- " + e).join("\n"),
    );
  }
  return svg;
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
