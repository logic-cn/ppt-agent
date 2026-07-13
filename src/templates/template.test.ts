import { describe, it, expect } from "vitest";
import {
  getTemplatePackById,
  getTemplateById,
  buildContextualPrompt,
} from "./index";

describe("template 瘦身为纯结构", () => {
  it("TemplatePack 不再包含 suggestedTheme / promptHints", () => {
    const pack = getTemplatePackById("quarterly-review");
    expect(pack).toBeDefined();
    expect(
      (pack as unknown as Record<string, unknown>).suggestedTheme,
    ).toBeUndefined();
    expect(
      (pack as unknown as Record<string, unknown>).promptHints,
    ).toBeUndefined();
  });

  it("quarterly-review 推荐叙事模式为 pyramid", () => {
    const pack = getTemplatePackById("quarterly-review");
    expect(pack?.suggestedMode).toBe("pyramid");
  });

  it("所有 pack 的 suggestedMode 遵循 scenario 映射", () => {
    const cases: Record<string, string> = {
      "quarterly-review": "pyramid",
      "product-launch": "narrative",
      "market-analysis": "briefing",
      "training-material": "instructional",
      "business-plan": "pyramid",
      "competitor-analysis": "briefing",
      "project-proposal": "pyramid",
      "annual-plan": "pyramid",
    };
    for (const [id, mode] of Object.entries(cases)) {
      expect(getTemplatePackById(id)?.suggestedMode).toBe(mode);
    }
  });

  it("Template 对象不再包含 suggestedTheme", () => {
    const tpl = getTemplateById("quarterly-review");
    expect(
      (tpl as unknown as Record<string, unknown>).suggestedTheme,
    ).toBeUndefined();
  });

  it("buildContextualPrompt 输出页面顺序+layout，并附叙事模式建议", () => {
    const pack = getTemplatePackById("quarterly-review");
    const prompt = buildContextualPrompt(pack!, "测试主题");
    expect(prompt).toContain("页面顺序");
    expect(prompt).toContain("建议叙事模式：pyramid");
    expect(prompt).not.toContain("创作提示");
  });
});
