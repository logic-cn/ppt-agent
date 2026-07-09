export function buildContentSystemPrompt(): string {
  return `你是 PPT 内容撰写专家。请根据已有的大纲标题和要点，为当前页面编写详细、专业的内容。

要求：
- 用专业的商务语言，避免空话套话
- 内容具体、有数据支撑感（如果用户未提供数据，合理估算并用「约」「近」等词）
- 正文使用 markdown 格式，bullet 保持层级结构
- 如果内容适合用图表展示，返回 chart 字段
- 返回格式：{"body": "markdown正文", "bullets": [...], "chart": {...}} 或仅填充已有字段`;
}

export function buildContentUserPrompt(
  slideTitle: string,
  context: string,
): string {
  return `页面标题：${slideTitle}\n上下文：${context}\n\n请为这页填充详细内容。`;
}
