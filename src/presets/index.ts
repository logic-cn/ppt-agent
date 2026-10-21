import type { DeckPreset } from "@/types/preset";
import type { TranslationKey } from "@/services/i18n";
import type { GenerationOptions, GenerationScenario } from "@/types/generation";
import type { Slide } from "@/types/deck";
import { DEFAULT_DESIGN } from "@/types/design";
import { EXAMPLES } from "@/examples/index";

// 模板 → preset（结构骨架转为 Slide，design 由 suggestedMode/visualStyle + 映射 palette 构成）
const TEMPLATE_PALETTE: Record<string, string> = {
  "quarterly-review": "business-blue",
  "product-launch": "tech-purple",
  "market-analysis": "vibrant-orange",
  "training-material": "minimal-white",
  "business-plan": "business-blue",
  "competitor-analysis": "vibrant-orange",
  "project-proposal": "business-blue",
  "annual-plan": "business-blue",
};

function skeletonToSlide(
  s: { layout: string; title: string },
  i: number,
): Slide {
  return {
    id: `s${i + 1}`,
    layout: s.layout as Slide["layout"],
    title: s.title,
  };
}

// 以下 TEMPLATE_PACKS 由原 src/templates/index.ts 的 BUILTIN_PACKS 平移而来，
// 仅保留 id/name/description/suggestedMode/suggestedVisualStyle/slides/qualityRules
const TEMPLATE_PACKS: Array<{
  id: string;
  name: string;
  description: string;
  suggestedMode: string;
  suggestedVisualStyle: string;
  slides: Array<{ layout: string; title: string }>;
  qualityRules: string[];
  /** 适用场景：展示 + 生成参数默认值 */
  scenario: GenerationScenario;
  /** 目标受众：展示 + 生成参数默认 audience */
  audience: string;
  /** 模板推荐的生成参数默认值 */
  defaultOptions: Partial<GenerationOptions>;
  /** 模板专属提示词：约束该场景的内容取向 */
  promptHints: string[];
}> = [
  {
    id: "quarterly-review",
    name: "季度业务复盘",
    description:
      "面向管理层的季度业务回顾，包含业绩概览、亮点与不足、下季度规划",
    suggestedMode: "pyramid",
    suggestedVisualStyle: "swiss-minimal",
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
    qualityRules: ["require_charts", "require_data"],
    scenario: "business_review",
    audience: "管理层",
    defaultOptions: { tone: "formal", density: "medium", includeCharts: true },
    promptHints: ["每页给出可核对的业务数据；不足与挑战页要诚实呈现，不做美化"],
  },
  {
    id: "product-launch",
    name: "产品发布会",
    description: "面向市场和用户的产品发布演示，突出产品价值和竞争力",
    suggestedMode: "narrative",
    suggestedVisualStyle: "dark-tech",
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
    qualityRules: ["require_cover", "require_closing"],
    scenario: "pitch",
    audience: "市场与用户",
    defaultOptions: {
      tone: "storytelling",
      density: "low",
      includeCharts: false,
    },
    promptHints: ["突出产品价值而非功能清单；核心功能页用前后对比呈现"],
  },
  {
    id: "market-analysis",
    name: "市场分析报告",
    description: "深入的市场研究分析，包含行业趋势、竞争格局和增长机会",
    suggestedMode: "briefing",
    suggestedVisualStyle: "editorial",
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
    qualityRules: ["require_charts", "require_data", "require_closing"],
    scenario: "market_analysis",
    audience: "决策层",
    defaultOptions: {
      tone: "consulting",
      density: "high",
      includeCharts: true,
    },
    promptHints: ["结论先行：先给判断再给论证；数据页标明统计口径与时间范围"],
  },
  {
    id: "training-material",
    name: "培训课件",
    description: "面向学员的培训教材，结构清晰、循序渐进",
    suggestedMode: "instructional",
    suggestedVisualStyle: "soft-rounded",
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
    qualityRules: ["require_cover", "require_closing"],
    scenario: "training",
    audience: "学员",
    defaultOptions: {
      tone: "concise",
      density: "medium",
      includeCharts: false,
    },
    promptHints: ["循序渐进：先讲学习目标再讲概念；每个核心概念配一个具体例子"],
  },
  {
    id: "business-plan",
    name: "融资商业计划书",
    description: "面向投资人的BP演示，展示商业模式、市场规模和增长潜力",
    suggestedMode: "pyramid",
    suggestedVisualStyle: "swiss-minimal",
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
    qualityRules: ["require_charts", "require_data", "require_closing"],
    scenario: "pitch",
    audience: "投资人",
    defaultOptions: {
      tone: "consulting",
      density: "medium",
      includeCharts: true,
    },
    promptHints: ["突出商业模式与壁垒；财务预测标明关键假设"],
  },
  {
    id: "competitor-analysis",
    name: "竞品分析",
    description: "深入对比主要竞品，找出差异化机会与竞争策略",
    suggestedMode: "briefing",
    suggestedVisualStyle: "editorial",
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
    qualityRules: ["require_charts", "require_data", "require_closing"],
    scenario: "market_analysis",
    audience: "产品与战略团队",
    defaultOptions: {
      tone: "consulting",
      density: "high",
      includeCharts: false,
    },
    promptHints: ["对比维度保持统一；差异化机会要落到具体可执行动作"],
  },
  {
    id: "project-proposal",
    name: "项目立项汇报",
    description: "面向管理层的新项目立项，讲清目标、价值、资源与风险",
    suggestedMode: "pyramid",
    suggestedVisualStyle: "swiss-minimal",
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
    qualityRules: ["require_charts", "require_data", "require_closing"],
    scenario: "proposal",
    audience: "评审委员会",
    defaultOptions: { tone: "formal", density: "medium", includeCharts: true },
    promptHints: ["明确目标、范围、里程碑与资源投入；风险页给出对应的缓解措施"],
  },
  {
    id: "annual-plan",
    name: "年度规划",
    description: "年度战略拆解，对齐目标、举措、资源与保障",
    suggestedMode: "pyramid",
    suggestedVisualStyle: "swiss-minimal",
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
    qualityRules: ["require_charts", "require_data", "require_closing"],
    scenario: "business_review",
    audience: "管理层与全员",
    defaultOptions: { tone: "formal", density: "medium", includeCharts: true },
    promptHints: ["目标要可衡量；按季度拆解到可执行动作，不停留在方向性表述"],
  },
];

export function getPresets(): DeckPreset[] {
  const fromTemplates: DeckPreset[] = TEMPLATE_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    design: {
      mode: p.suggestedMode as DeckPreset["design"]["mode"],
      visualStyle:
        p.suggestedVisualStyle as DeckPreset["design"]["visualStyle"],
      palette: TEMPLATE_PALETTE[p.id] ?? DEFAULT_DESIGN.palette,
    },
    slides: p.slides.map(skeletonToSlide),
    qualityRules: p.qualityRules,
    scenario: p.scenario,
    audience: p.audience,
    defaultOptions: p.defaultOptions,
    promptHints: p.promptHints,
  }));
  const fromGallery: DeckPreset[] = EXAMPLES.map((e) => ({
    id: e.id,
    name: e.name,
    design: e.design,
    slides: e.slides,
  }));
  return [...fromTemplates, ...fromGallery];
}

export function getPresetById(id: string): DeckPreset | undefined {
  return getPresets().find((p) => p.id === id);
}

/** 场景 → 界面 locale key（模板选择页展示适用场景） */
export const SCENARIO_LABEL_KEY: Record<GenerationScenario, TranslationKey> = {
  business_review: "scenario.businessReview",
  pitch: "scenario.pitch",
  training: "scenario.training",
  market_analysis: "scenario.marketAnalysis",
  proposal: "scenario.proposal",
  custom: "scenario.custom",
};
