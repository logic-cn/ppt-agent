// src/presets/template-context.test.ts
import { describe, it, expect } from "vitest";
import {
  buildTemplateGenerationContext,
  getTemplateGenerationContexts,
} from "./template-context";
import { SEMANTIC_ROLES } from "@/types/page-plan";
import type { SlideLayout } from "@/types/layouts";
import { getPresetById } from "./index";

describe("buildTemplateGenerationContext", () => {
  it("quarterly-review 派生 slidePlan：首 cover 尾 closing，角色/布局均合法", () => {
    const ctx = buildTemplateGenerationContext("quarterly-review");
    expect(ctx).toBeTruthy();
    const plan = ctx!.slidePlan;
    expect(plan.length).toBeGreaterThan(0);

    expect(plan[0].role).toBe("cover");
    expect(plan[plan.length - 1].role).toBe("closing");

    for (const item of plan) {
      expect(SEMANTIC_ROLES).toContain(item.role);
      expect(item.suggestedLayout).toBeTruthy();
      expect(item.instruction).toBeTruthy();
    }
  });

  it("每个模板都派生 context，且 promptHints 非空", () => {
    const contexts = getTemplateGenerationContexts();
    expect(contexts.length).toBeGreaterThan(0);
    for (const ctx of contexts) {
      expect(ctx.slidePlan.length).toBeGreaterThan(0);
      expect(ctx.promptHints.length).toBeGreaterThan(0);
      expect(ctx.templateId).toBeTruthy();
    }
  });

  it("unknown preset 返回 null", () => {
    expect(buildTemplateGenerationContext("no-such-preset")).toBeNull();
  });

  it("suggestedLayout 均为合法 SlideLayout 枚举值", () => {
    const ctx = buildTemplateGenerationContext("market-analysis");
    const validLayouts: SlideLayout[] = [
      "cover",
      "section",
      "content",
      "two-column",
      "chart",
      "image",
      "closing",
      "cols-2",
      "cols-3",
      "cols-4",
      "cols-5",
      "cols-6",
      "metrics",
      "quote",
      "timeline",
    ];
    for (const item of ctx!.slidePlan) {
      expect(validLayouts).toContain(item.suggestedLayout);
    }
  });

  // ---- 模板级生成参数（路线图 §12.2 / §12.2.1）----

  it("defaultOptions 合并模板声明的场景/受众/语气等默认值", () => {
    const ctx = buildTemplateGenerationContext("quarterly-review")!;
    const preset = getPresetById("quarterly-review")!;
    expect(ctx.defaultOptions.pageCount).toBe(preset.slides.length);
    expect(ctx.defaultOptions.scenario).toBe(preset.scenario);
    expect(ctx.defaultOptions.audience).toBe(preset.audience);
    expect(ctx.defaultOptions.tone).toBe(preset.defaultOptions?.tone);
    expect(ctx.defaultOptions.density).toBe(preset.defaultOptions?.density);
  });

  it("promptHints = 通用模板提示 + 模板专属提示", () => {
    const ctx = buildTemplateGenerationContext("business-plan")!;
    const preset = getPresetById("business-plan")!;
    const hints = preset.promptHints ?? [];
    expect(hints.length).toBeGreaterThan(0);
    for (const h of hints) {
      expect(ctx.promptHints).toContain(h);
    }
    // 通用提示仍在（页数/角色顺序这类硬约束）
    expect(ctx.promptHints.length).toBeGreaterThan(hints.length);
  });

  it("每个模板都声明了场景与适用对象（展示与生成参数的基础）", () => {
    for (const ctx of getTemplateGenerationContexts()) {
      const preset = getPresetById(ctx.templateId)!;
      expect(preset.scenario, `${preset.id} 缺 scenario`).toBeTruthy();
      expect(preset.audience, `${preset.id} 缺 audience`).toBeTruthy();
      expect(preset.defaultOptions?.tone, `${preset.id} 缺 tone`).toBeTruthy();
      expect(
        preset.promptHints?.length,
        `${preset.id} 缺专属提示`,
      ).toBeGreaterThan(0);
    }
  });
});
