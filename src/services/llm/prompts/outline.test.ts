import { describe, it, expect } from "vitest";
import { buildOutlineSystemPrompt } from "./outline";
import type { DesignLock } from "../../../types/design";

const DESIGN: DesignLock = {
  mode: "pyramid",
  visualStyle: "swiss-minimal",
  palette: "business-blue",
};

describe("buildOutlineSystemPrompt", () => {
  it("注入 DesignLock 的叙事模式/视觉风格/配色/少样本", () => {
    const prompt = buildOutlineSystemPrompt({
      design: DESIGN,
      fewShot: "EXAMPLE",
    });

    // 叙事模式 titleRule
    expect(prompt).toContain("标题写结论句而非话题词");
    // 视觉风格 character
    expect(prompt).toContain("严格网格、锐利几何");
    // 7 个配色 HEX
    for (const hex of [
      "#2563EB",
      "#3B82F6",
      "#FBBF24",
      "#0C1929",
      "#1A2D42",
      "#F1F5F9",
      "#94A3B8",
    ]) {
      expect(prompt).toContain(hex);
    }
    // 少样本
    expect(prompt).toContain("EXAMPLE");
  });

  it("可选 templateCtx 出现且 fewShot 缺省时为空", () => {
    const withTpl = buildOutlineSystemPrompt({
      design: DESIGN,
      templateCtx: "模板名称：季度复盘",
    });
    expect(withTpl).toContain("模板名称：季度复盘");

    const withoutFewShot = buildOutlineSystemPrompt({ design: DESIGN });
    expect(withoutFewShot).not.toContain("EXAMPLE");
  });
});
