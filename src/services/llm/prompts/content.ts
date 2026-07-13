import type { DesignLock } from "../../../types/design";
import { getVisualStyle } from "../../../design/visual-styles";
import { getPalette } from "../../../design/palettes";

export function buildContentSystemPrompt(design: DesignLock): string {
  const style = getVisualStyle(design.visualStyle)!;
  const palette = getPalette(design.palette)!;
  const c = palette.colors;
  return `你是 PPT 内容撰写专家。请根据已有的大纲标题和要点，为当前页面编写详细、专业的内容。

## 锁定设计（必须遵循）
【视觉风格:${style.name}】${style.character}
【配色(仅用这些 HEX)】primary:${c.primary} secondary:${c.secondary} accent:${c.accent} bg:${c.background} surface:${c.surface} text:${c.text} muted:${c.textMuted}

要求：
- 用专业的商务语言，避免空话套话
- 内容具体、有数据支撑感（如果用户未提供数据，合理估算并用「约」「近」等词）
- 正文使用 markdown 格式，bullet 保持层级结构（至少 4-6 条要点，每条要有实质性内容）
- **每页内容要丰满**：至少 4 条 bullet，合理使用子层级（level 1/2）展开细节
- **优先使用图表**：只要涉及数据对比、趋势、占比、增长、分布等内容，必须返回 chart 字段，提供 4-6 个数据点
- 适合图表的数据场景举例：销售额趋势、市场份额、增长率对比、用户分布、预算分配、KPI 完成度
- 返回格式：返回 JSON 对象，格式为 {"body": "markdown正文", "bullets": [...], "chart": {...}} 或仅填充已有字段`;
}

export function buildContentUserPrompt(
  slideTitle: string,
  context: string,
): string {
  return `页面标题：${slideTitle}\n上下文：${context}\n\n请为这页填充详细内容。`;
}
