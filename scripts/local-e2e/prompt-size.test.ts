/**
 * 临时诊断：离线复算真实 plan/底稿下的单页提示词体积（不调模型）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildSvgGenPrompt } from "@/services/llm/prompts/svg-gen";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";
import { compactSvgForPrompt } from "@/engine/svg/executor";
import { clipBaseSvg } from "@/engine/svg/plan-budget";
import type { PagePlanItem } from "@/types/page-plan";

describe("真实产物的提示词体积", () => {
  it("打印每页提示词字符数", () => {
    const dir = resolve(
      process.cwd(),
      "dist/local-e2e/2026-10-21T12-25-53-249Z",
    );
    const plan = JSON.parse(
      readFileSync(join(dir, "plan.json"), "utf8"),
    ) as PagePlanItem[];
    const spec = buildSpecLock(DEFAULT_DESIGN);
    for (const [i, p] of plan.entries()) {
      const prompt = buildSvgGenPrompt({
        specLock: spec,
        plan: p,
        pageIndex: i,
        totalPages: plan.length,
        slim: true,
      });
      console.log(
        `页${i + 1} role=${p.role} chart=${p.chartType ?? "-"} promptChars=${prompt.length}`,
      );
    }
    // 底稿回传（cohort 纠正路径）体积
    const svgFile = readdirSync(dir).find((f) => f.endsWith(".svg"));
    if (svgFile) {
      const svg = readFileSync(join(dir, svgFile), "utf8");
      console.log(
        `底稿 ${svgFile} chars=${svg.length} compact=${compactSvgForPrompt(svg).length} clipped=${clipBaseSvg(compactSvgForPrompt(svg)).length}`,
      );
    }
    expect(plan.length).toBeGreaterThan(0);
  });
});
