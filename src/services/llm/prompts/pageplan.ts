/**
 * 页面结构规划（pagePlan）提示词。
 * 注入 DesignLock（叙事模式 + 视觉风格 + 配色）并要求 LLM 输出 JSON 数组。
 * 本提示词只规划「每页的语义角色与内容」，不产出像素坐标（后续 executor 负责）。
 */

import type { DesignLock } from "../../../types/design";
import { getMode } from "../../../design/narrative-modes";
import { getVisualStyle } from "../../../design/visual-styles";
import { getPalette } from "../../../design/palettes";
import type { TemplateGenerationContext } from "../../../presets/template-context";

export function buildPagePlanSystemPrompt(opts: {
  design: DesignLock;
  fewShot?: string;
  templateCtx?: TemplateGenerationContext;
}): string {
  const mode = getMode(opts.design.mode);
  const style = getVisualStyle(opts.design.visualStyle)!;
  const palette = getPalette(opts.design.palette)!;
  const c = palette.colors;

  const lockBlock = [
    "你是 PPT 结构策划。严格按以下锁定的设计契约规划页面结构：",
    `【叙事模式:${mode.name}】${mode.titleRule} ${mode.structureTendency}`,
    `【视觉风格:${style.name}】${style.character}`,
    `【配色(仅用这些 HEX)】primary:${c.primary} secondary:${c.secondary} accent:${c.accent} bg:${c.background} surface:${c.surface} text:${c.text} muted:${c.textMuted}`,
  ].join("\n");

  let prompt = `${lockBlock}

你的任务是依据主题与设计锁，规划整份 PPT 的页面结构（pagePlan）。你只做「结构规划」，不写像素坐标、不写 SVG。

## 语义角色（每页只能选一个，且只承载一个核心信息）
- "cover"：封面（必须是第一页）
- "section"：章节过渡页
- "content"：普通正文（含列表/论述）
- "metrics"：核心数字海报（突出一个关键指标，配 chartType 或数值）
- "quote"：金句 / 核心论点（quote 字段，可选 attribution）
- "timeline"：时间线 / 阶段走势（按时间或阶段演进）
- "comparison"：对比 / 并列两组内容
- "process"：流程 / 步骤
- "closing"：结尾页（必须是最后一页）

## 强约束
1. 第一页必须为 "cover"，最后一页必须为 "closing"。
2. 根据内容逻辑关系**混用多种角色**，避免连续多页同一角色。
3. 涉及数据/对比/趋势时，优先用 metrics / comparison / timeline 并给出 chartType。
4. 语言与用户输入一致（中文输入则中文规划）。

## 输出格式（必须是合法 JSON 对象，顶层为 {"pages": [...]}）
{
  "pages": [
    {
      "role": SemanticRole,
      "title": string,
      "intent": string,                // 该页核心意图，一句话
      "bullets"?: string[],          // 正文/章节页的要点
      "chartType"?: "bar"|"pie"|"line"|"doughnut",
      "quote"?: string,              // quote 角色用
      "attribution"?: string        // quote 出处
    }
  ]
}`;

  if (opts.fewShot) {
    prompt += `\n\n${opts.fewShot}`;
  }

  if (opts.templateCtx) {
    const { slidePlan, promptHints } = opts.templateCtx;
    const planLines = slidePlan
      .map(
        (item, i) =>
          `- 第 ${i + 1} 页：role="${item.role}"，${item.instruction}`,
      )
      .join("\n");
    prompt += `\n\n## 模板结构指引（请严格遵守）
本次生成必须遵循以下模板编排，**输出页数必须与模板精确匹配（共 ${slidePlan.length} 页）**，
每页 role 必须与模板指定一致，第一页必须为 cover，最后一页必须为 closing。

${planLines}

模板提示：
${promptHints.map((h) => `- ${h}`).join("\n")}`;
  }

  return prompt;
}

export function buildPagePlanUserPrompt(params: {
  topic: string;
  audience?: string;
  pageCount?: number;
  docContent?: string;
}): string {
  const parts: string[] = [];

  if (params.docContent) {
    parts.push(
      `根据以下文档内容规划页面结构：\n\n${params.docContent.slice(0, 8000)}`,
    );
  } else {
    parts.push(`主题：${params.topic}`);
  }

  if (params.audience) {
    parts.push(`目标受众：${params.audience}`);
  }

  if (params.pageCount) {
    parts.push(`建议页数：${params.pageCount} 页`);
  }

  parts.push(
    `\n请输出完整的页面结构规划 JSON（{"pages":[...]}），从 cover 到 closing，角色分布合理、内容充实。`,
  );

  return parts.join("\n");
}
