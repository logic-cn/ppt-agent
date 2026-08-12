/**
 * 模板生成上下文（P2 模板产品化）：
 * 模板不只是一份静态骨架，还能约束 AI 生成的页面结构。
 * TemplateGenerationContext 由模板派生，注入 pagePlan 提示词后，
 * LLM 输出必须保持模板的页数、每页语义角色与内容意图。
 */

import type { SemanticRole } from "@/types/page-plan";
import type { SlideLayout } from "@/types/layouts";
import { getPresets, getPresetById } from "./index";

export interface TemplateSlidePlan {
  /** 该页应承载的语义角色 */
  role: SemanticRole;
  /** 建议的 slide layout（角色映射后的合法布局） */
  suggestedLayout: SlideLayout;
  /** 该页内容意图说明，注入提示词约束 LLM */
  instruction: string;
}

export interface TemplateGenerationContext {
  templateId: string;
  /** 模板建议的默认生成选项 */
  defaultOptions: {
    pageCount: number;
  };
  slidePlan: TemplateSlidePlan[];
  promptHints: string[];
}

/** SlideLayout → SemanticRole 映射（仅用于模板骨架推导，非法值降级 content） */
const LAYOUT_TO_ROLE: Record<string, SemanticRole> = {
  cover: "cover",
  section: "section",
  content: "content",
  "two-column": "content",
  chart: "metrics",
  image: "content",
  closing: "closing",
  "cols-2": "content",
  "cols-3": "content",
  "cols-4": "content",
  "cols-5": "content",
  "cols-6": "content",
  metrics: "metrics",
  quote: "quote",
  timeline: "timeline",
};

/** 模板通用提示词：引导 LLM 充实模板骨架、保持角色顺序 */
const TEMPLATE_HINTS = [
  "严格按模板页数与角色顺序输出，不要增删页面",
  "每页围绕模板给定意图充实内容，数据页给出结构化 chartType",
  "标题保持模板语义，可在其中融入用户主题",
];

/** 从模板骨架 slide 派生该页的语义角色（无对应角色时回退 content） */
function layoutToRole(layout: string): SemanticRole {
  return LAYOUT_TO_ROLE[layout] ?? "content";
}

/** 由模板标题（如「Q{季度}业务复盘」）生成内容意图说明 */
function buildInstruction(
  layout: string,
  title: string,
  index: number,
): string {
  const role = layoutToRole(layout);
  const roleHint: Record<SemanticRole, string> = {
    cover: "封面：交代主题与场合",
    section: "章节过渡：引出下一部分",
    content: "正文：围绕标题展开要点",
    metrics: "核心数字：突出关键指标",
    quote: "金句：表达核心论点",
    timeline: "时间线：按阶段演进",
    comparison: "对比：并列两组内容",
    process: "流程：步骤化推进",
    closing: "结尾：收束与行动号召",
  };
  const titlePart = title.replace(/[{}]/g, "").trim() || "主题页";
  return `第 ${index + 1} 页（${roleHint[role]}）：内容应围绕「${titlePart}」展开`;
}

/** 从模板派生生成上下文 */
export function buildTemplateGenerationContext(
  presetId: string,
): TemplateGenerationContext | null {
  const preset = getPresetById(presetId);
  if (!preset) return null;
  if (preset.slides.length === 0) return null;

  const slidePlan: TemplateSlidePlan[] = preset.slides.map((slide, i) => {
    const role = layoutToRole(slide.layout);
    return {
      role,
      suggestedLayout: slide.layout,
      instruction: buildInstruction(slide.layout, slide.title, i),
    };
  });

  return {
    templateId: preset.id,
    defaultOptions: { pageCount: preset.slides.length },
    slidePlan,
    promptHints: TEMPLATE_HINTS,
  };
}

/** 全部模板类 preset 的生成上下文（画廊示例不参与） */
export function getTemplateGenerationContexts(): TemplateGenerationContext[] {
  return getPresets()
    .filter((p) => Array.isArray(p.qualityRules))
    .map((p) => buildTemplateGenerationContext(p.id))
    .filter((ctx): ctx is TemplateGenerationContext => ctx !== null);
}
