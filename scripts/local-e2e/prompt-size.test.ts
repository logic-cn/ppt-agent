/**
 * 临时探针：量一量单页 SVG 生成提示词的体积（不调模型）。
 * 用法：npx vitest run --config vitest.local.config.ts scripts/local-e2e/prompt-size.test.ts
 */
import { describe, it, expect } from "vitest";
import { buildSvgGenPrompt } from "@/services/llm/prompts/svg-gen";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";
import type { PagePlanItem } from "@/types/page-plan";

describe("单页提示词体积", () => {
  it("打印各角色/档位的提示词字符数", () => {
    const spec = buildSpecLock(DEFAULT_DESIGN);
    const base: PagePlanItem = {
      role: "content",
      title: "第三章：关键抓手二——数据治理",
      intent: "说明数据治理在企业 AI 落地中的关键地位",
      bullets: ["数据资产盘点", "血缘与质量监控", "权限与脱敏", "知识库构建"],
    };
    for (const slim of [true, false]) {
      for (const role of ["cover", "section", "content", "comparison", "metrics"]) {
        const plan = { ...base, role: role as PagePlanItem["role"] };
        const prompt = buildSvgGenPrompt({
          specLock: spec,
          plan,
          pageIndex: 2,
          totalPages: 7,
          slim,
        });
        console.log(
          `slim=${slim} role=${role.padEnd(11)} 字符数=${String(prompt.length).padStart(6)} 估算token≈${Math.round(prompt.length / 1.5)}`,
        );
      }
    }
    expect(true).toBe(true);
  });
});
