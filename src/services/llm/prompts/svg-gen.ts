import { buildPresetVocabPrompt } from "@/engine/svg/presets";
import { buildIconVocabPrompt } from "@/engine/svg/icons";
import { buildLayoutSkeleton } from "@/engine/svg/layout-skeleton";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem, SemanticRole } from "@/types/page-plan";

/**
 * 构造单页 SVG 生成 prompt（参照 PPT Master executor-base 的分层结构）：
 * 1) 设计契约（画布/配色/字体，来自 SpecLock）
 * 2) 角色指引：本页语义角色的版式要点
 * 3) 设备菜单：常规页面载体的 SVG 实现词汇表
 * 4) 版式几何对照：内容关系 → 结构与像素比例
 * 5) 条件模块：图表页注入 data-chart 约定
 * 可选注入：contentBrief（内容素材防丢失）、instruction（用户定向修改）、
 * extraGuidance（early gate 等下发的全 deck 一致性纠正要求）。
 */

/** 角色版式指引：本页该长什么样（一句话约束，避免模型每页自由发挥） */
export const ROLE_GUIDANCE: Record<SemanticRole, string> = {
  cover:
    "封面：大标题居中或左对齐，副标题/日期用小字，可加渐变色带或几何装饰，元素少而精",
  section: "章节页：大号章节序号 + 标题，背景装饰弱化，与封面语言呼应",
  content: "正文：标题带下接内容区，用卡片/列表/双栏承载 3-5 条要点，层级清晰",
  metrics: "核心数字：大字号数字是唯一视觉焦点，配小注与趋势标记，其余元素弱化",
  quote: "金句：金句大字居中，出处小字右对齐或跟随，大量留白",
  timeline: "时间线：横向基线 + 等距节点，标签上下交替，节点文字不得重叠",
  comparison:
    "对比：左右（或上下）等分栏，两栏内部结构一致便于对照，中缝加分隔线",
  process: "流程：节点 + 方向箭头，步骤编号，节点内文字精简",
  closing: "结尾：感谢/行动号召大字，呼应封面的装饰语言，落款/联系方式小字",
};

/** 设备菜单：常规页面构件的职责与 SVG 写法（参照 executor-base device menu） */
export const DEVICE_MENU = `## 常用页面载体（按内容职责选用，不要堆砌）
- 渐变色带：封面底/章节场/区域分隔——linearGradient 2-3 个 stop，取 deck 主色
- 圆角卡片：并列内容块——<rect rx>，surface 底色；悬浮于照片/深色板上才加阴影
- 数字徽章：有序步骤/章节标记——<circle> + 居中数字，章节号可超大
- KPI 卡：指标名 + 大数字 + 趋势/对比小注，一页最多 1-2 个
- 结论条：标题下的一句话结论——半透明色带（fill-opacity 0.06-0.10）+ 中字号
- 分隔线：分区/分列——1px <line> 用 textMuted，或 2px accent 短条
- 金句块：引述——超大引号或 accent 竖线 + 大字号 + 出处小字
- 时间线/步骤条：有序事件——基线 <line> + 等距节点圆点，标签上下交替
- 对比双栏：两方案对比——1:1 分栏，两栏内部结构一致`;

/** 版式几何对照：内容关系 → 结构与参考像素（以 1280 宽为基准，其他画布等比换算） */
export function layoutGeometryText(canvasW: number): string {
  const k = canvasW / 1280;
  if (k === 1) return LAYOUT_GEOMETRY_1280;
  return `${LAYOUT_GEOMETRY_1280}\n（本画布宽 ${canvasW}px，上述数值按 ${Math.round(k * 100) / 100}× 等比换算）`;
}
const LAYOUT_GEOMETRY_1280 = `## 版式几何对照（安全区：四周 40px 边距内）
- 单一焦点论点：居中单栏或大留白——主栏 800-1000px 宽，留白 40-60%
- 对称比较：1:1 双栏或四象限——栏间距 40-60px，象限约 560×250
- 证据主导 + 结论：不对称分栏 3:7 或 2:8——重侧 840-1024px
- 时序/阶段：横向时间线——基线取画面竖直中位偏下，节点等距
- 收束/结尾：中心大字 + 弱化背景——主体居中，四周留白`;

export function buildSvgGenPrompt(opts: {
  specLock: SpecLock;
  plan: PagePlanItem;
  pageIndex: number;
  totalPages: number;
  contentBrief?: string;
  instruction?: string;
  /** 全 deck 一致性纠正要求（early gate 下发），追加到硬性要求之后 */
  extraGuidance?: string;
  /** 本地小模型档：删设备菜单、词汇表截断到前 6 条，降低 prefill 开销 */
  slim?: boolean;
}): string {
  const { specLock, plan, pageIndex, totalPages } = opts;
  const slim = !!opts.slim;
  const cw = specLock.canvas.w;
  const ch = specLock.canvas.h;
  // 图表约定：当 pagePlan 指定了图表类型，要求用结构化 <g data-chart-type> 标记，
  // 翻译器会将其转为原生可编辑图表，避免用零散 rect 模拟。
  const chartRule = plan.chartType
    ? `\n7. 本页需要图表，请用 <g data-chart-type="${plan.chartType}" data-chart-data='[{"label":"示例","value":数字}]'> 包裹图表，data-chart-data 为 JSON 数组（每项含 label 与数字 value），翻译器会将其转为原生可编辑图表；图表内不要再用零散 rect 模拟柱/扇区。图表 <g> 的坐标请用 x / y / width / height 属性直接标注（也可用 transform="translate(x,y)" 平移），确保翻译器能正确定位。图表若有标题，请在 <g> 上加 data-chart-title="标题文字"。`
    : "";
  const roleGuidance = ROLE_GUIDANCE[plan.role] ?? ROLE_GUIDANCE.content;
  // 确定性版式骨架：几何由程序算定，模型只在框内落字与配色。
  // 命中骨架的页面（content/comparison/timeline/process/metrics/quote）
  // 不再注入通用版式几何对照；本地档同时省去设备菜单以降低 prefill。
  const skeleton = buildLayoutSkeleton(plan, specLock);
  const t = specLock.typography;
  const typographyBlock = t
    ? `
字号锚点（跨页统一是排版质感的底线；±2px 内微调，装饰性例外每页不超过 2 处）：
- 主标题 ${t.title}px / 章节标题 ${t.section}px / 正文 ${t.body}px / 注释 ${t.caption}px / 特大数字 ${t.hero}px
`
    : "";
  const extraBlock = opts.extraGuidance
    ? `\n\n## 全 deck 一致性要求（必须遵守）\n${opts.extraGuidance}`
    : "";
  const briefBlock = opts.contentBrief
    ? `\n\n本页内容素材（必须完整、原样呈现以下全部文字与数据，不得遗漏、改写或编造）：\n${opts.contentBrief}`
    : "";
  const instructionBlock = opts.instruction
    ? `\n\n用户对本页的定向修改要求（优先级最高，必须满足；未提及的部分保持原有设计）：${opts.instruction}`
    : "";
  return `你是 PPT 视觉设计师。基于以下设计契约，产出第 ${pageIndex + 1}/${totalPages} 页（角色 ${plan.role}，标题：${plan.title}，意图：${plan.intent}${
    plan.chartType ? `，建议图表类型：${plan.chartType}` : ""
  }）的 SVG。

画布：viewBox="0 0 ${cw} ${ch}"，像素坐标系，单页。

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
${typographyBlock}
## 本页角色版式要点
${roleGuidance}

硬性要求：
 1. 只输出一个根元素 <svg viewBox="0 0 ${cw} ${ch}" xmlns="http://www.w3.org/2000/svg">...</svg>，不要任何解释文字，绝对禁止用 \`\`\` 代码块或任何标记语言包裹，必须以 <svg 开头、以 </svg> 结尾。
2. 只使用白名单元素：svg、g、defs、rect、circle、ellipse、path、text、tspan、line、polygon、polyline、image、linearGradient、radialGradient、stop。
3. 绝对禁止 foreignObject、script、use、a 以及任何外部资源引用（除 # 锚点与 data: 内嵌）。
4. 所有颜色必须从上面的配色表中取值，禁止出现十六进制外的任意其他颜色字符串。
5. 文本必须可被选中和编辑，使用 <text>/<tspan> 而非转曲路径；不要栅格化图片。
6. 设计精良、留白充足、层级清晰，元素坐标与尺寸必须落在 0..${cw} / 0..${ch} 范围内。${chartRule}
${slim && skeleton ? "" : `${DEVICE_MENU}

`}${slim ? buildPresetVocabPrompt(6) : buildPresetVocabPrompt()}

${slim ? buildIconVocabPrompt(6) : buildIconVocabPrompt()}

${skeleton ? skeleton.promptBlock : layoutGeometryText(cw)}${extraBlock}${briefBlock}${instructionBlock}

 只输出 <svg>...</svg>。`;
}
