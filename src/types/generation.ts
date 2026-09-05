/**
 * 生成前参数控制（路线图 §7.3）。
 * 在生成大纲前约束 LLM 的场景、语气、密度、图表倾向与输出语言；
 * 全部字段可选，未提供的项由模型按主题自行决定。
 */

export type GenerationScenario =
  | "business_review"
  | "pitch"
  | "training"
  | "market_analysis"
  | "proposal"
  | "custom";

export type GenerationTone =
  "formal" | "consulting" | "concise" | "storytelling";

export type GenerationDensity = "low" | "medium" | "high";

export type GenerationLanguage = "zh-CN" | "en-US";

export interface GenerationOptions {
  /** 目标受众，如「投资人」「新员工」 */
  audience?: string;
  /** 使用场景，影响结构与叙事侧重 */
  scenario?: GenerationScenario;
  /**
   * 核心信息：一句话说清整份 deck 必须让听众记住/认同/执行的事。
   * 参照 PPT Master 沟通契约的 core_message——
   * cover 点题、正文论证、closing 回扣都围绕它展开。
   */
  coreMessage?: string;
  /** 期望页数；质量检查会据此校验页数偏差 */
  pageCount?: number;
  /** 表达语气 */
  tone?: GenerationTone;
  /** 单页信息密度 */
  density?: GenerationDensity;
  /** 数据/对比/趋势页的图表倾向：true 鼓励、false 避免、缺省由模型决定 */
  includeCharts?: boolean;
  /** 预留：X1 SVG 管线暂不产出图片素材，该字段暂不参与提示词 */
  includeImages?: boolean;
  /** 输出语言；未提供时默认「与用户输入一致」 */
  language?: GenerationLanguage;
}
