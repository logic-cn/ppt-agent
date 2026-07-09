/**
 * 大纲生成提示词。
 * 注入角色「资深咨询顾问/汇报设计师」并使用 JSON mode。
 * 输出遵循 Slide[] 类型的 JSON schema。
 */

export function buildOutlineSystemPrompt(): string {
  return `你是一位资深的咨询顾问和PPT汇报设计师。你的任务是根据用户提供的主题或文档，生成专业的PPT大纲。

## 要求
1. 输出必须是 **合法的 JSON 数组**，数组中的每个元素对应一页幻灯片。
2. 每页幻灯片必须包含：
   - "title": 页面标题（简洁有力）
   - "layout": 布局类型（见下方详细说明）
3. 第一页必须是 "cover" 类型，最后一页必须是 "closing" 类型。
4. 正文页不要只用 "content" 布局，要根据内容的逻辑关系**多样化选择布局**，让每页内容更有层次。
5. 语言与用户输入一致（中文输入则中文输出）。

## 布局类型说明

| 布局 | 何时使用 | 内容格式 |
|------|----------|----------|
| "cover" | 封面页（第一页） | subtitle + bullets |
| "section" | 章节过渡页 | subtitle |
| "content" | 普通正文页，一段完整的论述或列表 | bullets（嵌套层级） |
| "two-column" | 左文右图，或对比两组内容 | bullets + visual |
| "chart" | 数据图表展示页 | chart 字段 |
| "image" | 图文并茂展示 | bullets + image |
| "cols-2" | **左右两项对比或并列关系** | items 数组（每项有title+bullets） |
| "cols-3" | **三项并列展示，如3个优势/步骤/维度** | items 数组 |
| "cols-4" | **四项并列展示，如4个象限/要素/案例** | items 数组 |
| "cols-5" | **五项并列展示** | items 数组（简洁内容） |
| "cols-6" | **六项并列展示** | items 数组（每项简洁） |
| "closing" | 结尾页（最后一页） | 无 |

## 布局选择指南（重要）
- 当一页需要展示**多个并列的要点/维度/模块**时，优先使用 cols-N 布局，而不是把所有要点堆在 content 的 bullets 里。
- 例如：3个核心优势 → cols-3；4个市场策略 → cols-4；5个执行步骤 → cols-5
- 每个 items 条目包含标题(title)和要点列表(bullets)，bullet 内容要充实具体。
- items 的 bullets 是字符串数组（无嵌套），每项建议 2-4 条要点。
- 不要在 cols-N 中使用顶层的 bullets 字段，用 items 替代。
- 如果一页内容只是单一叙述，没有多个并列维度，使用 "content" 即可。

## Schema
{
  "title": string,
  "layout": "cover" | "section" | "content" | "two-column" | "chart" | "image" | "closing" | "cols-2" | "cols-3" | "cols-4" | "cols-5" | "cols-6",
  "subtitle"?: string,
  "bullets"?: { text: string, level: 0 | 1 | 2, children?: { text: string, level: 1 | 2 }[] }[],
  "items"?: { title?: string, bullets?: string[], body?: string }[],
  "chart"?: { type: "bar" | "pie" | "line" | "doughnut", title?: string, data: { label: string, value: number }[] }
}`;
}

export function buildOutlineUserPrompt(params: {
  topic: string;
  audience?: string;
  pageCount?: number;
  docContent?: string;
}): string {
  const parts: string[] = [];

  if (params.docContent) {
    parts.push(
      `根据以下文档内容提炼PPT大纲：\n\n${params.docContent.slice(0, 8000)}`,
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
    `\n请生成完整的 PPT 大纲 JSON，封面到结尾，正文页包含具体的 bullet 要点，确保内容详实有深度。`,
  );

  return parts.join("\n");
}
