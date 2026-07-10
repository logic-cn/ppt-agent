import type { Template } from "@/types/template";
import { quarterlyReview } from "./quarterly-review";
import { productLaunch } from "./product-launch";
import { businessPlan } from "./business-plan";
import { marketAnalysis } from "./market-analysis";
import { trainingMaterial } from "./training-material";
import { competitorAnalysis } from "./competitor-analysis";
import { projectProposal } from "./project-proposal";
import { annualPlan } from "./annual-plan";

const BUILTIN_TEMPLATES: Template[] = [
  quarterlyReview,
  productLaunch,
  businessPlan,
  marketAnalysis,
  trainingMaterial,
  competitorAnalysis,
  projectProposal,
  annualPlan,
];

export function getTemplates(): Template[] {
  return BUILTIN_TEMPLATES;
}

export function getTemplateById(id: string): Template | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

// --- P2: TemplatePack 注册表 ---
import type { TemplatePack, TemplateGenerationContext } from "@/types/template";

const BUILTIN_PACKS: TemplatePack[] = [
  {
    id: "quarterly-review",
    name: "季度业务复盘",
    description:
      "面向管理层的季度业务回顾，包含业绩概览、亮点与不足、下季度规划",
    scenario: "business_review",
    suggestedTheme: "business-blue",
    defaultOptions: {
      topic: "",
      scenario: "business_review",
      pageCount: 10,
      tone: "formal",
      density: "medium",
      includeCharts: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "Q{季度}业务复盘" },
      { layout: "section", title: "业绩概览" },
      { layout: "chart", title: "核心指标" },
      { layout: "content", title: "亮点回顾" },
      { layout: "content", title: "不足与挑战" },
      { layout: "content", title: "竞品动态" },
      { layout: "section", title: "下季度规划" },
      { layout: "content", title: "目标与策略" },
      { layout: "content", title: "资源需求" },
      { layout: "closing", title: "感谢" },
    ],
    promptHints: [
      "使用具体的KPI数据填充图表",
      "突出同比和环比增长",
      "不足部分要提出改进方案",
    ],
    qualityRules: ["require_charts", "require_data"],
  },
  {
    id: "product-launch",
    name: "产品发布会",
    description: "面向市场和用户的产品发布演示，突出产品价值和竞争力",
    scenario: "pitch",
    suggestedTheme: "vibrant-orange",
    defaultOptions: {
      topic: "",
      scenario: "pitch",
      pageCount: 8,
      tone: "storytelling",
      density: "medium",
      includeCharts: true,
      includeImages: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "{产品名}发布会" },
      { layout: "content", title: "行业洞察" },
      { layout: "content", title: "用户痛点" },
      { layout: "content", title: "我们的方案" },
      { layout: "two-column", title: "核心功能" },
      { layout: "chart", title: "市场前景" },
      { layout: "content", title: "竞品对比" },
      { layout: "closing", title: "未来展望" },
    ],
    promptHints: [
      "强调产品差异化价值",
      "用故事化的方式描述用户痛点",
      "竞品对比要突出优势",
    ],
    qualityRules: ["require_cover", "require_closing"],
  },
  {
    id: "market-analysis",
    name: "市场分析报告",
    description: "深入的市场研究分析，包含行业趋势、竞争格局和增长机会",
    scenario: "market_analysis",
    suggestedTheme: "tech-purple",
    defaultOptions: {
      topic: "",
      scenario: "market_analysis",
      pageCount: 12,
      tone: "consulting",
      density: "high",
      includeCharts: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "{行业}市场分析报告" },
      { layout: "section", title: "行业概览" },
      { layout: "chart", title: "市场规模" },
      { layout: "content", title: "行业趋势" },
      { layout: "section", title: "竞争分析" },
      { layout: "chart", title: "市场份额" },
      { layout: "content", title: "主要玩家" },
      { layout: "content", title: "竞争策略对比" },
      { layout: "section", title: "增长机会" },
      { layout: "content", title: "新兴机会" },
      { layout: "cols-3", title: "进入策略" },
      { layout: "closing", title: "总结与建议" },
    ],
    promptHints: [
      "使用权威数据源的市场数据",
      "竞争分析要包含2-3个主要对手",
      "增长机会要给出可操作建议",
    ],
    qualityRules: ["require_charts", "require_data", "require_closing"],
  },
  {
    id: "training-material",
    name: "培训课件",
    description: "面向学员的培训教材，结构清晰、循序渐进",
    scenario: "training",
    suggestedTheme: "minimal-white",
    defaultOptions: {
      topic: "",
      scenario: "training",
      pageCount: 15,
      tone: "concise",
      density: "medium",
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "{主题}培训" },
      { layout: "content", title: "学习目标" },
      { layout: "content", title: "什么是{主题}" },
      { layout: "content", title: "核心概念" },
      { layout: "cols-3", title: "三大原则" },
      { layout: "content", title: "最佳实践" },
      { layout: "content", title: "常见误区" },
      { layout: "content", title: "案例分析" },
      { layout: "content", title: "实操练习" },
      { layout: "content", title: "要点回顾" },
      { layout: "section", title: "进阶内容" },
      { layout: "content", title: "扩展阅读" },
      { layout: "cols-2", title: "工具推荐" },
      { layout: "content", title: "Q&A" },
      { layout: "closing", title: "感谢参与" },
    ],
    promptHints: [
      "适合零基础学员，由浅入深",
      "每个概念配一个具体例子",
      "案例部分要有实际应用场景",
    ],
    qualityRules: ["require_cover", "require_closing"],
  },
  {
    id: "business-plan",
    name: "融资商业计划书",
    description: "面向投资人的BP演示，展示商业模式、市场规模和增长潜力",
    scenario: "proposal",
    suggestedTheme: "business-blue",
    defaultOptions: {
      topic: "",
      scenario: "proposal",
      pageCount: 10,
      tone: "formal",
      density: "high",
      includeCharts: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "商业计划书" },
      { layout: "content", title: "公司简介" },
      { layout: "content", title: "核心团队" },
      { layout: "content", title: "解决的问题" },
      { layout: "two-column", title: "产品/服务" },
      { layout: "chart", title: "市场机会" },
      { layout: "content", title: "商业模式" },
      { layout: "chart", title: "财务预测" },
      { layout: "content", title: "融资计划" },
      { layout: "closing", title: "联系我们" },
    ],
    promptHints: [
      "突出市场规模的TAM/SAM/SOM",
      "商业模式要清晰展示收入来源",
      "财务预测要给出3-5年的数据",
      "融资用途要具体分配到各环节",
    ],
    qualityRules: ["require_charts", "require_data", "require_closing"],
  },
  {
    id: "competitor-analysis",
    name: "竞品分析",
    description: "深入对比主要竞品，找出差异化机会与竞争策略",
    scenario: "market_analysis",
    suggestedTheme: "tech-purple",
    defaultOptions: {
      topic: "",
      scenario: "market_analysis",
      pageCount: 11,
      tone: "consulting",
      density: "high",
      includeCharts: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "{行业}竞品分析" },
      { layout: "content", title: "分析背景与目的" },
      { layout: "section", title: "行业格局" },
      { layout: "chart", title: "市场份额分布" },
      { layout: "content", title: "主要竞品概览" },
      { layout: "section", title: "功能对比" },
      { layout: "cols-3", title: "核心能力对比" },
      { layout: "two-column", title: "定价策略" },
      { layout: "content", title: "差异化机会" },
      { layout: "section", title: "行动建议" },
      { layout: "closing", title: "总结" },
    ],
    promptHints: [
      "对比至少3个主要竞品",
      "用表格或并列布局做功能对照",
      "差异化机会要落到可执行的策略",
    ],
    qualityRules: ["require_charts", "require_data", "require_closing"],
  },
  {
    id: "project-proposal",
    name: "项目立项汇报",
    description: "面向管理层的新项目立项，讲清目标、价值、资源与风险",
    scenario: "proposal",
    suggestedTheme: "business-blue",
    defaultOptions: {
      topic: "",
      scenario: "proposal",
      pageCount: 9,
      tone: "formal",
      density: "medium",
      includeCharts: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "{项目}立项汇报" },
      { layout: "content", title: "项目背景" },
      { layout: "content", title: "目标与价值" },
      { layout: "chart", title: "预期收益" },
      { layout: "section", title: "方案概览" },
      { layout: "cols-3", title: "关键举措" },
      { layout: "content", title: "资源需求" },
      { layout: "content", title: "风险与应对" },
      { layout: "closing", title: "申请立项" },
    ],
    promptHints: [
      "目标必须可量化（KPI/OKR）",
      "用图表展示投入产出预测",
      "风险要配缓解措施",
    ],
    qualityRules: ["require_charts", "require_data", "require_closing"],
  },
  {
    id: "annual-plan",
    name: "年度规划",
    description: "年度战略拆解，对齐目标、举措、资源与保障",
    scenario: "business_review",
    suggestedTheme: "business-blue",
    defaultOptions: {
      topic: "",
      scenario: "business_review",
      pageCount: 10,
      tone: "formal",
      density: "high",
      includeCharts: true,
      language: "zh-CN",
    },
    slides: [
      { layout: "cover", title: "{年份}年度规划" },
      { layout: "content", title: "上一年回顾" },
      { layout: "section", title: "战略目标" },
      { layout: "cols-3", title: "三大战略主题" },
      { layout: "chart", title: "目标拆解" },
      { layout: "section", title: "关键举措" },
      { layout: "two-column", title: "组织与人才" },
      { layout: "content", title: "资源与预算" },
      { layout: "content", title: "风险与保障" },
      { layout: "closing", title: "承诺与展望" },
    ],
    promptHints: [
      "战略主题要少而精（3个以内）",
      "目标拆解到季度可衡量",
      "预算与人力要对应具体措施",
    ],
    qualityRules: ["require_charts", "require_data", "require_closing"],
  },
];

export function getTemplatePacks(): TemplatePack[] {
  return BUILTIN_PACKS;
}

export function getTemplatePackById(id: string): TemplatePack | undefined {
  return BUILTIN_PACKS.find((p) => p.id === id);
}

export function buildTemplateGenerationContext(
  pack: TemplatePack,
  topic: string,
): TemplateGenerationContext {
  const roleLayoutMap: Record<
    string,
    TemplateGenerationContext["slidePlan"][number]
  > = {
    cover: {
      role: "cover",
      suggestedLayout: "cover",
      instruction: "吸引注意力的封面",
    },
    section: {
      role: "summary",
      suggestedLayout: "section",
      instruction: "章节过渡页",
    },
    content: {
      role: "insight",
      suggestedLayout: "content",
      instruction: "核心内容阐述",
    },
    "two-column": {
      role: "analysis",
      suggestedLayout: "two-column",
      instruction: "对比分析",
    },
    chart: {
      role: "chart",
      suggestedLayout: "chart",
      instruction: "数据可视化",
    },
    closing: {
      role: "closing",
      suggestedLayout: "closing",
      instruction: "总结与号召",
    },
  };

  const slidePlan = pack.slides.map((s) => {
    const mapped = roleLayoutMap[s.layout] ?? {
      role: "insight" as const,
      suggestedLayout: s.layout,
      instruction: "",
    };
    return {
      ...mapped,
      instruction: `${mapped.instruction}：${s.title}`,
    };
  });

  return {
    templateId: pack.id,
    defaultOptions: { ...pack.defaultOptions, topic },
    slidePlan,
    promptHints: pack.promptHints ?? [],
  };
}

/** 将模板结构转成注入 outline prompt 的字符串 */
export function buildContextualPrompt(
  pack: TemplatePack,
  topic: string,
): string {
  const ctx = buildTemplateGenerationContext(pack, topic);
  const lines: string[] = [];
  lines.push(`模板名称：${pack.name}`);
  lines.push(`场景：${pack.scenario}`);
  lines.push(`总页数：${ctx.slidePlan.length} 页\n`);
  lines.push(`页面顺序：`);
  ctx.slidePlan.forEach((sp, i) => {
    lines.push(`  ${i + 1}. [${sp.suggestedLayout}] ${sp.instruction}`);
  });
  if (ctx.promptHints.length > 0) {
    lines.push(`\n创作提示：`);
    ctx.promptHints.forEach((h) => lines.push(`  - ${h}`));
  }
  return lines.join("\n");
}
