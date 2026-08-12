// src/presets/template-context.test.ts
import { describe, it, expect } from "vitest";
import {
  buildTemplateGenerationContext,
  getTemplateGenerationContexts,
} from "./template-context";
import { SEMANTIC_ROLES } from "@/types/page-plan";
import type { SlideLayout } from "@/types/layouts";

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
});
