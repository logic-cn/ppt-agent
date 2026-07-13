import type { NarrativeModeId } from "../types/design";

export interface NarrativeModeDef {
  id: NarrativeModeId;
  name: string;
  bestFor: string;
  titleRule: string;
  structureTendency: string;
  notesRegister: string;
  pageSkeleton: string;
}

export const NARRATIVE_MODES: Record<NarrativeModeId, NarrativeModeDef> = {
  pyramid: {
    id: "pyramid",
    name: "结论先行",
    bestFor: "决策/分析/汇报",
    titleRule:
      "标题写结论句而非话题词，例如「留存而非拉新驱动增长」而非「用户分析」；每个数字都配对比(同比/环比/标杆)与「所以呢」。",
    structureTendency:
      "封面/导语→结论→MECE 支撑论点→每页自含一个结论；数据源标注。",
    notesRegister: "首句即要点，随后 2-3 个带比较的事实，权威沉稳。",
    pageSkeleton:
      "标题(结论) / 一句话要点 / 3 个 MECE 论点(各带对比数据) / 来源",
  },
  narrative: {
    id: "narrative",
    name: "故事线",
    bestFor: "路演/案例/品牌",
    titleRule: "标题推动情节，制造张力与转折；用悬念而非标签。",
    structureTendency: "情境→冲突→问题→解答→升华；情绪节奏分明。",
    notesRegister: "口语化、有画面感、像在讲故事。",
    pageSkeleton: "钩子 / 冲突 / 转折 / 高潮 / 收尾",
  },
  instructional: {
    id: "instructional",
    name: "教学式",
    bestFor: "培训/教程/科普",
    titleRule: "标题点明本页要教会什么；步骤清晰、并列展开。",
    structureTendency: "目标→概念分解→步骤→示例→练习→回顾；由浅入深。",
    notesRegister: "讲解口吻、循序渐进、配例子。",
    pageSkeleton: "学习目标 / 概念 / 步骤 / 案例 / 练习",
  },
  showcase: {
    id: "showcase",
    name: "视觉冲击",
    bestFor: "发布会/品牌露出",
    titleRule: "极简文案，一页一个大写意；让视觉说话。",
    structureTendency: "全幅大图/大数字主导；文字极少；情绪节拍。",
    notesRegister: "简短有力、烘托氛围。",
    pageSkeleton: "主视觉 / 一句话主张 / 大数字",
  },
  briefing: {
    id: "briefing",
    name: "信息通报",
    bestFor: "周报/状态/参考",
    titleRule: "标题用话题词、中性、完整；不强行下结论。",
    structureTendency: "主题标题、权重均匀、可扫读；无 thesis。",
    notesRegister: "客观、完整、要点式。",
    pageSkeleton: "主题标题 / 要点列表 / 数据",
  },
  custom: {
    id: "custom",
    name: "自定义",
    bestFor: "混合意图",
    titleRule: "由 modeBehavior 具体描述。",
    structureTendency: "由 modeBehavior 具体描述。",
    notesRegister: "由 modeBehavior 具体描述。",
    pageSkeleton: "由 modeBehavior 具体描述。",
  },
};

const SCENARIO_TO_MODE: Record<string, NarrativeModeId> = {
  business_review: "pyramid",
  pitch: "narrative",
  training: "instructional",
  market_analysis: "briefing",
  proposal: "pyramid",
  custom: "briefing",
};

export function selectModeByScenario(scenario?: string): NarrativeModeId {
  return (scenario && SCENARIO_TO_MODE[scenario]) || "briefing";
}

export function getMode(id: NarrativeModeId): NarrativeModeDef {
  return NARRATIVE_MODES[id];
}
