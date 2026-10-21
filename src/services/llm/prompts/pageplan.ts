/**
 * 页面结构规划（pagePlan）提示词。
 * 注入 DesignLock（叙事模式 + 视觉风格 + 配色）并要求 LLM 输出 JSON 数组。
 * 本提示词只规划「每页的语义角色与内容」，不产出像素坐标（后续 executor 负责）。
 */

import type { DesignLock } from "../../../types/design";
import type {
  GenerationDensity,
  GenerationOptions,
  GenerationScenario,
  GenerationTone,
} from "../../../types/generation";
import { getMode } from "../../../design/narrative-modes";
import { getVisualStyle } from "../../../design/visual-styles";
import { getPalette } from "../../../design/palettes";
import type { TemplateGenerationContext } from "../../../presets/template-context";

/** 生成选项 → 提示词描述（纯数据，导出供测试与 UI 对齐参考） */
export const SCENARIO_PROMPT_LABEL: Record<GenerationScenario, string> = {
  business_review: "业务复盘/经营汇报",
  pitch: "融资路演/商业计划",
  training: "培训课件",
  market_analysis: "市场分析报告",
  proposal: "方案提案",
  custom: "通用场景",
};

export const TONE_PROMPT_LABEL: Record<GenerationTone, string> = {
  formal: "正式严谨，用词规范",
  consulting: "咨询顾问风格：结论先行、金字塔结构，每页给出明确观点（so-what）",
  concise: "精简直接，短句要点",
  storytelling: "叙事风格：有故事线和递进感",
};

export const DENSITY_PROMPT_LABEL: Record<GenerationDensity, string> = {
  low: "低密度：每页要点不超过 3 条，每条一句话，留白充足",
  medium: "中密度：每页 3-5 条要点",
  high: "高密度：每页 5-7 条要点，信息饱满",
};

/**
 * 场景 → 大纲义务（参照 PPT Master plan-core 的 intent→outline 义务表）：
 * 指定场景时，大纲必须让对应义务有页面承载，防止结构性遗漏。
 */
export const SCENARIO_OBLIGATIONS: Record<GenerationScenario, string> = {
  business_review: "- 基线 → 进展 → 差异归因 → 证据/数据 → 风险 → 责任与下一步",
  pitch:
    "- 痛点/机会 → 方案 → 证据（市场/traction）→ 预判反驳 → 明确的行动请求",
  training: "- 前置知识 → 递进讲解 → 示例演示 → 练习/检验理解",
  market_analysis: "- 相关事实与背景 → 驱动机制/因果 → 结论与启示",
  proposal: "- 决策请求 → 备选方案对比 → 评估标准 → 资源与拖延代价",
  custom: "- 无额外义务，按主题自行组织",
};

export function buildPagePlanSystemPrompt(opts: {
  design: DesignLock;
  fewShot?: string;
  templateCtx?: TemplateGenerationContext;
  options?: GenerationOptions;
  /** 本地小模型档：精简角色说明与输出示例，降低 prefill 开销 */
  slim?: boolean;
}): string {
  const mode = getMode(opts.design.mode);
  const style = getVisualStyle(opts.design.visualStyle)!;
  const palette = getPalette(opts.design.palette)!;
  const c = palette.colors;

  // 本地小模型档：删角色长说明与配色细节（pagePlan 不输出颜色），只留结构骨架
  if (opts.slim) {
    let slim = `你是 PPT 结构策划。叙事模式「${mode.name}」，视觉风格「${style.name}」。只规划页面结构，不写 SVG。

每页选一个语义角色：cover(封面，第一页) / section(章节页) / content(正文) / metrics(核心数字) / quote(金句) / timeline(时间线) / comparison(对比) / process(流程) / closing(结尾，最后一页)。
混用多种角色，避免连续同角色。涉及数据/趋势优先 metrics/comparison/timeline 并给 chartType。
${opts.options?.language === "zh-CN" ? "全部输出使用中文。" : opts.options?.language ? "输出使用 English。" : "语言与用户输入一致。"}

只输出合法 JSON 对象：{"pages":[{"role":"...","title":"...","intent":"一句话意图","bullets":["..."],"chartType":"bar|pie|line|doughnut","quote":"...","attribution":"...","notes":"讲稿正文"}]}（bullets/chartType/quote/attribution 可省略；notes 写 80-120 字口语化讲稿，串联本页要点、点明 so-what 并自然过渡到下一页）`;
    if (opts.fewShot) slim += `\n\n${opts.fewShot}`;
    if (opts.templateCtx) {
      const { slidePlan } = opts.templateCtx;
      const planLines = slidePlan
        .map(
          (item, i) =>
            `- 第 ${i + 1} 页：role="${item.role}"，${item.instruction}`,
        )
        .join("\n");
      slim += `\n\n## 模板结构指引（必须严格遵守，页数与 role 精确匹配，共 ${slidePlan.length} 页）\n${planLines}`;
    }
    return slim;
  }

  const lockBlock = [
    "你是 PPT 结构策划。严格按以下锁定的设计契约规划页面结构：",
    `【叙事模式:${mode.name}】${mode.titleRule} ${mode.structureTendency}`,
    `【视觉风格:${style.name}】${style.character}`,
    `【配色(仅用这些 HEX)】primary:${c.primary} secondary:${c.secondary} accent:${c.accent} bg:${c.background} surface:${c.surface} text:${c.text} muted:${c.textMuted}`,
  ].join("\n");

  const langRule = opts.options?.language
    ? opts.options.language === "zh-CN"
      ? "4. 全部输出必须使用中文。"
      : "4. 全部输出必须使用英文（English）。"
    : "4. 语言与用户输入一致（中文输入则中文规划）。";

  // 场景 → 大纲义务（仅指定 scenario 时注入，避免无条件占用 token）
  const scenarioObligations = opts.options?.scenario
    ? SCENARIO_OBLIGATIONS[opts.options.scenario]
    : undefined;
  const obligationBlock = scenarioObligations
    ? `\n\n## 场景大纲义务（必须逐条落实）\n本次使用场景为「${SCENARIO_PROMPT_LABEL[opts.options!.scenario!]}」，大纲必须让以下义务有对应页面承载，不得遗漏：\n${scenarioObligations}`
    : "";

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
${langRule}
${obligationBlock}

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
      "attribution"?: string,       // quote 出处
      "notes"?: string               // 演讲者备注：80-120 字口语化讲稿，串联本页要点、给出 so-what 与下一句过渡
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
  docContent?: string;
  /** 已合并的生成选项（generatePagePlan 负责合并顶层兼容字段） */
  options?: GenerationOptions;
}): string {
  const options = params.options ?? {};
  const parts: string[] = [];

  if (params.docContent) {
    parts.push(
      `根据以下文档内容规划页面结构：\n\n${params.docContent.slice(0, 8000)}`,
    );
  } else {
    parts.push(`主题：${params.topic}`);
  }

  if (options.audience) {
    parts.push(`目标受众：${options.audience}`);
  }

  if (options.coreMessage) {
    parts.push(
      `核心信息（整份 deck 必须服务于此：cover 点题、正文逐层论证、closing 回扣）：${options.coreMessage}`,
    );
  }

  if (options.pageCount) {
    parts.push(`建议页数：${options.pageCount} 页`);
  }

  if (options.scenario) {
    parts.push(`使用场景：${SCENARIO_PROMPT_LABEL[options.scenario]}`);
  }

  if (options.tone) {
    parts.push(`表达语气：${TONE_PROMPT_LABEL[options.tone]}`);
  }

  if (options.density) {
    parts.push(`信息密度：${DENSITY_PROMPT_LABEL[options.density]}`);
  }

  if (options.includeCharts === false) {
    parts.push("图表倾向：尽量避免图表页，不要输出 chartType");
  } else if (options.includeCharts === true) {
    parts.push("图表倾向：涉及数据/对比/趋势的页面优先给出 chartType");
  }

  parts.push(
    `\n请输出完整的页面结构规划 JSON（{"pages":[...]}），从 cover 到 closing，角色分布合理、内容充实。`,
  );

  return parts.join("\n");
}
