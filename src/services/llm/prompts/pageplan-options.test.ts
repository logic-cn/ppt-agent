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

  it("指定 scenario 时注入大纲义务表，未指定时不注入", () => {
    const withScenario = buildPagePlanSystemPrompt({
      design: DESIGN,
      options: { scenario: "pitch" },
    });
    expect(withScenario).toContain("场景大纲义务");
    expect(withScenario).toContain("预判反驳");
    expect(withScenario).toContain("行动请求");

    const without = buildPagePlanSystemPrompt({ design: DESIGN });
    expect(without).not.toContain("场景大纲义务");
  });

  it("coreMessage 注入 user prompt 并要求全篇围绕展开", () => {
    const prompt = buildPagePlanUserPrompt({
      topic: "t",
      options: { coreMessage: "Q3 增长靠海外市场" },
    });
    expect(prompt).toContain("核心信息");
    expect(prompt).toContain("Q3 增长靠海外市场");
    expect(prompt).toContain("closing 回扣");
  });

  it("slim 本地档：精简角色说明与配色细节，保留模板指引与 few-shot", () => {
    const full = buildPagePlanSystemPrompt({
      design: DESIGN,
      fewShot: "【示例】...",
    });
    const slim = buildPagePlanSystemPrompt({
      design: DESIGN,
      fewShot: "【示例】...",
      slim: true,
    });
    expect(slim.length).toBeLessThan(full.length);
    expect(slim).toContain("只规划页面结构，不写 SVG");
    expect(slim).toContain("cover(封面，第一页)");
    expect(slim).not.toContain("## 强约束");
    expect(slim).not.toContain("primary:#");
    expect(slim).toContain("【示例】...");

    const slimTpl = buildPagePlanSystemPrompt({
      design: DESIGN,
      slim: true,
      templateCtx: {
        slidePlan: [{ role: "cover", instruction: "封面页" }],
        promptHints: ["h"],
      } as never,
    });
    expect(slimTpl).toContain("模板结构指引");
    expect(slimTpl).toContain('role="cover"');
  });
});
