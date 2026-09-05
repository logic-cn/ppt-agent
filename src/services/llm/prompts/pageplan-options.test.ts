// src/services/llm/prompts/pageplan-options.test.ts
import { describe, it, expect } from "vitest";
import {
  buildPagePlanSystemPrompt,
  buildPagePlanUserPrompt,
  SCENARIO_PROMPT_LABEL,
  TONE_PROMPT_LABEL,
  DENSITY_PROMPT_LABEL,
} from "./pageplan";
import type { DesignLock } from "@/types/design";

const DESIGN: DesignLock = {
  mode: "briefing",
  visualStyle: "soft-rounded",
  palette: "business-blue",
};

describe("pagePlan 生成选项注入（路线图 §7.3）", () => {
  it("user prompt 注入场景/语气/密度/受众/页数", () => {
    const prompt = buildPagePlanUserPrompt({
      topic: "AI 行业分析",
      options: {
        scenario: "market_analysis",
        tone: "consulting",
        density: "high",
        audience: "投资人",
        pageCount: 12,
      },
    });
    expect(prompt).toContain(
      `使用场景：${SCENARIO_PROMPT_LABEL.market_analysis}`,
    );
    expect(prompt).toContain(`表达语气：${TONE_PROMPT_LABEL.consulting}`);
    expect(prompt).toContain(`信息密度：${DENSITY_PROMPT_LABEL.high}`);
    expect(prompt).toContain("目标受众：投资人");
    expect(prompt).toContain("建议页数：12 页");
  });

  it("includeCharts true/false 分别注入鼓励与避免图表", () => {
    const encourage = buildPagePlanUserPrompt({
      topic: "t",
      options: { includeCharts: true },
    });
    expect(encourage).toContain("优先给出 chartType");
    expect(encourage).not.toContain("不要输出 chartType");

    const avoid = buildPagePlanUserPrompt({
      topic: "t",
      options: { includeCharts: false },
    });
    expect(avoid).toContain("不要输出 chartType");
    expect(avoid).not.toContain("优先给出 chartType");
  });

  it("空 options 不注入任何生成要求", () => {
    const prompt = buildPagePlanUserPrompt({ topic: "t", options: {} });
    expect(prompt).not.toContain("使用场景：");
    expect(prompt).not.toContain("表达语气：");
    expect(prompt).not.toContain("信息密度：");
    expect(prompt).not.toContain("目标受众：");
    expect(prompt).not.toContain("建议页数：");
    expect(prompt).not.toContain("图表倾向：");
  });

  it("language 指定后 system prompt 覆盖默认语言规则", () => {
    const zh = buildPagePlanSystemPrompt({
      design: DESIGN,
      options: { language: "zh-CN" },
    });
    expect(zh).toContain("全部输出必须使用中文");
    expect(zh).not.toContain("语言与用户输入一致");

    const en = buildPagePlanSystemPrompt({
      design: DESIGN,
      options: { language: "en-US" },
    });
    expect(en).toContain("全部输出必须使用英文");
    expect(en).not.toContain("语言与用户输入一致");
  });

  it("未指定 language 时保持与用户输入一致", () => {
    const prompt = buildPagePlanSystemPrompt({ design: DESIGN });
    expect(prompt).toContain("语言与用户输入一致");
  });
});
