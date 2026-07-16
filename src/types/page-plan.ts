/**
 * 页面结构规划（pagePlan）的语义角色与规划项类型。
 * 这是 L1 Strategist 产出「设计契约 + 语义角色规划」的一部分，
 * 供 L2 Executor 逐页生成 SVG 时使用。
 */

/** 每页的语义角色：决定该页承载的核心信息类型与视觉结构 */
export type SemanticRole =
  | "cover" // 封面
  | "section" // 章节过渡
  | "content" // 普通正文
  | "metrics" // 核心数字海报
  | "quote" // 金句 / 核心论点
  | "timeline" // 时间线 / 阶段走势
  | "comparison" // 对比 / 并列
  | "process" // 流程 / 步骤
  | "closing"; // 结尾

export const SEMANTIC_ROLES: SemanticRole[] = [
  "cover",
  "section",
  "content",
  "metrics",
  "quote",
  "timeline",
  "comparison",
  "process",
  "closing",
];

/** 规划项可建议的图表类型（由后续 executor 决定具体数据） */
export type PlanChartType = "bar" | "pie" | "line" | "doughnut";

/** 单页内容规划：不含像素坐标，只描述「这一页要讲什么、怎么讲」 */
export interface PagePlanItem {
  /** 语义角色，决定视觉结构 */
  role: SemanticRole;
  /** 页面主标题 */
  title: string;
  /** 该页要传达的核心意图 / 一句话说明 */
  intent: string;
  /** 要点列表（正文页/章节页用） */
  bullets?: string[];
  /** 建议图表类型（metrics / comparison / timeline 等可带） */
  chartType?: PlanChartType;
  /** 引用/金句正文（quote 角色用） */
  quote?: string;
  /** 金句出处（quote 角色用） */
  attribution?: string;
}
