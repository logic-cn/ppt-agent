import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";

/**
 * 构造单页 SVG 生成 prompt。
 * 将 specLock 的画布/配色/字体约束注入给 LLM，并强制白名单元素与固定 viewBox。
 */
export function buildSvgGenPrompt(opts: {
  specLock: SpecLock;
  plan: PagePlanItem;
  pageIndex: number;
  totalPages: number;
}): string {
  const { specLock, plan, pageIndex, totalPages } = opts;
  // 图表约定：当 pagePlan 指定了图表类型，要求用结构化 <g data-chart-type> 标记，
  // 翻译器会将其转为原生可编辑图表，避免用零散 rect 模拟。
  const chartRule = plan.chartType
    ? `\n7. 本页需要图表，请用 <g data-chart-type="${plan.chartType}" data-chart-data='[{"label":"示例","value":数字}]'> 包裹图表，data-chart-data 为 JSON 数组（每项含 label 与数字 value），翻译器会将其转为原生可编辑图表；图表内不要再用零散 rect 模拟柱/扇区。图表 <g> 的坐标请用 x / y / width / height 属性直接标注（也可用 transform="translate(x,y)" 平移），确保翻译器能正确定位。`
    : "";
  return `你是 PPT 视觉设计师。基于以下设计契约，产出第 ${pageIndex + 1}/${totalPages} 页（角色 ${plan.role}，标题：${plan.title}，意图：${plan.intent}${
    plan.chartType ? `，建议图表类型：${plan.chartType}` : ""
  }）的 SVG。

画布：viewBox="0 0 1280 720"，像素坐标系，单页。

配色（只能从以下取值，禁止其他颜色）：
- primary  ${specLock.colors.primary}
- secondary  ${specLock.colors.secondary}
- accent  ${specLock.colors.accent}
- background  ${specLock.colors.background}
- surface  ${specLock.colors.surface}
- text  ${specLock.colors.text}
- textMuted  ${specLock.colors.textMuted}

字体（只能使用以下字体）：
- 标题 font-family="${specLock.fonts.title}"
- 正文 font-family="${specLock.fonts.body}"

硬性要求：
 1. 只输出一个根元素 <svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">...</svg>，不要任何解释文字，绝对禁止用 \`\`\` 代码块或任何标记语言包裹，必须以 <svg 开头、以 </svg> 结尾。
2. 只使用白名单元素：svg、g、defs、rect、circle、ellipse、path、text、tspan、line、polygon、polyline、image、linearGradient、radialGradient、stop。
3. 绝对禁止 foreignObject、script、use、a 以及任何外部资源引用（除 # 锚点与 data: 内嵌）。
4. 所有颜色必须从上面的配色表中取值，禁止出现十六进制外的任意其他颜色字符串。
5. 文本必须可被选中和编辑，使用 <text>/<tspan> 而非转曲路径；不要栅格化图片。
6. 设计精良、留白充足、层级清晰，元素坐标与尺寸必须落在 0..1280 / 0..720 范围内。${chartRule}

 只输出 <svg>...</svg>。`;
}
