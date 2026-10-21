import type { Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import type { GenerationOptions, GenerationScenario } from "@/types/generation";

export interface DeckPreset {
  id: string;
  name: string;
  description?: string;
  design: DesignLock;
  slides: Slide[];
  qualityRules?: string[];
  /**
   * 适用场景（路线图 §12.2）：既用于模板选择页展示，也作为生成参数默认值
   * （影响叙事侧重与场景义务）
   */
  scenario?: GenerationScenario;
  /** 目标受众（展示 + 生成参数默认 audience） */
  audience?: string;
  /** 模板推荐的生成参数默认值（语气/密度/图表倾向等） */
  defaultOptions?: Partial<GenerationOptions>;
  /** 模板专属提示词：追加在通用模板提示之后，约束该场景的内容取向 */
  promptHints?: string[];
}
