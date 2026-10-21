// src/services/llm/prompts/pageplan-template.test.ts
import { describe, it, expect } from "vitest";
import { buildPagePlanSystemPrompt, buildPagePlanUserPrompt } from "./pageplan";
import { buildTemplateGenerationContext } from "@/presets/template-context";
import type { DesignLock } from "@/types/design";

const DESIGN: DesignLock = {
  mode: "briefing",
  visualStyle: "soft-rounded",
  palette: "business-blue",
};

describe("pagePlan 模板约束注入", () => {
  it("注入 templateCtx 后要求页数精确匹配模板且逐页遵循角色", () => {
    const ctx = buildTemplateGenerationContext("quarterly-review")!;
    const prompt = buildPagePlanSystemPrompt({
      design: DESIGN,
      templateCtx: ctx,
    });

    expect(prompt).toContain("模板结构指引");
    expect(prompt).toContain(`共 ${ctx.slidePlan.length} 页`);
    expect(prompt).toContain(ctx.slidePlan[1].instruction);
    expect(prompt).toContain("第一页必须为 cover，最后一页必须为 closing");
  });

  it("不含 templateCtx 时不输出模板指引", () => {
    const prompt = buildPagePlanSystemPrompt({ design: DESIGN });
    expect(prompt).not.toContain("模板结构指引");
  });

  it("模板专属提示词进入提示词（内容取向按场景差异化）", () => {
    const ctx = buildTemplateGenerationContext("business-plan")!;
    const prompt = buildPagePlanSystemPrompt({
      design: DESIGN,
      templateCtx: ctx,
    });
    expect(prompt).toContain("模板提示");
    for (const h of ctx.promptHints) {
      expect(prompt).toContain(h);
    }
  });

  it("模板的场景/受众/语气作为生成参数进入用户提示词", () => {
    const ctx = buildTemplateGenerationContext("market-analysis")!;
    const user = buildPagePlanUserPrompt({
      topic: "某行业市场分析",
      options: ctx.defaultOptions,
    });
    expect(user).toContain("某行业市场分析");
    expect(user).toContain(`目标受众：${ctx.defaultOptions.audience}`);
    expect(user).toContain("使用场景：");
    expect(user).toContain("表达语气：");
  });
});
