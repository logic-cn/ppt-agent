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
   - "layout": 布局类型，只能是以下之一： "cover", "section", "content", "two-column", "chart", "image", "closing"
   - "bullets": 要点列表（嵌套结构），数组项包含 "text"（内容）、"level"（0/1/2）、可选 "children"（子要点）
3. 第一页必须是 "cover" 类型，最后一页必须是 "closing" 类型。
4. 正文页优先使用 "content" 布局。需要对比或有配图时使用 "two-column"。
5. 如果内容涉及数据对比或趋势，建议用 "chart" 布局，并添加 chart 字段。
6. 每一页的 bullets 层级不要超过2级。
7. 语言与用户输入一致（中文输入则中文输出）。

## Schema
{
  "title": string,
  "layout": "cover" | "section" | "content" | "two-column" | "chart" | "image" | "closing",
  "subtitle"?: string,
  "bullets"?: { text: string, level: 0 | 1 | 2, children?: { text: string, level: 1 | 2 }[] }[],
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
