import type { SpecLock } from "@/design/spec-lock";
import { isPresetShape, PRESET_SHAPES } from "../presets";
import { isIcon, ICONS } from "../icons";
import { validateSvgContract } from "../spec-contract";

export type SvgIssue = {
  severity: "error" | "warn";
  message: string;
  location?: string;
  /**
   * 分类标记，供修复环与导出锁分流处置：
   * - "brand"：文字色与底面色都是色板 token 且组合本身不达标——整份 deck
   *   的系统问题，模型无法逐页修，应升级为 deck 级提示（对标 brand escalation）。
   * - "page"：单页越位用色导致的对比度塌陷——模型/自动 patch 可修。
   */
  kind?: "brand" | "page";
};

const GEOMETRIC_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "image",
  "text",
]);

function num(attr: string | undefined): number | undefined {
  if (attr === undefined) return undefined;
  const v = Number(attr);
  return Number.isFinite(v) ? v : undefined;
}

function attr(part: string, name: string): string | undefined {
  const m = part.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : undefined;
}

function tagNameOf(openTag: string): string {
  const m = openTag.match(/^<([a-zA-Z][\w:-]*)/);
  return m ? m[1] : "";
}

// 提取 openTag 在 matchIndex 处开标签的内部内容；必须从 matchIndex 起查找，
// 否则多元素 SVG 中每次都会取到第一个同名元素的 content
function tagContent(svg: string, openTag: string, matchIndex: number): string {
  const tagName = tagNameOf(openTag);
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const m = svg.slice(matchIndex).match(re);
  return m ? m[1].replace(/<[^>]+>/g, "") : "";
}

/** 提取元素开标签内部的原始内容（保留子标签，用于统计 tspan 行数） */
function tagRawContent(
  svg: string,
  openTag: string,
  matchIndex: number,
): string {
  const tagName = tagNameOf(openTag);
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const m = svg.slice(matchIndex).match(re);
  return m ? m[1] : "";
}

/**
 * 文本宽度估算已收敛到 engine/svg/text-measure（单一真源）：
 * 校验器、prompt 字数预算、骨架容量与 translator 全部同源同口径。
 */
export { estimateTextWidthPx } from "../text-measure";
import { estimateTextWidthPx } from "../text-measure";

/** 解析元素自身/祖先链上的 transform="translate(dx, dy)" 平移量（仅支持最简形式） */
function translateOffset(part: string): { dx: number; dy: number } {
  const m = part.match(/translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/);
  if (!m) return { dx: 0, dy: 0 };
  return {
    dx: Number.parseFloat(m[1]) || 0,
    dy: m[2] !== undefined ? Number.parseFloat(m[2]) || 0 : 0,
  };
}

export function checkSvg(svg: string, specLock: SpecLock): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const canvasW = specLock.canvas.w;
  const canvasH = specLock.canvas.h;

  const contractErrors = validateSvgContract(svg, {
    w: canvasW,
    h: canvasH,
  });
  for (const e of contractErrors) {
    issues.push({ severity: "error", message: e });
  }

  const tagRegex = /<([a-zA-Z][\w:-]*)(?:\s[^>]*?)?\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(svg)) !== null) {
    const full = match[0];
    const name = match[1].toLowerCase();
    if (!GEOMETRIC_TAGS.has(name)) continue;

    const loc = `${name}@${match.index}`;
    const { dx, dy } = translateOffset(full);

    if (name === "rect") {
      const x = (num(attr(full, "x")) ?? 0) + dx;
      const y = (num(attr(full, "y")) ?? 0) + dy;
      const w = num(attr(full, "width")) ?? 0;
      const h = num(attr(full, "height")) ?? 0;
      checkBounds(x, y, w, h, canvasW, canvasH, loc, issues);
    } else if (name === "image") {
      const x = (num(attr(full, "x")) ?? 0) + dx;
      const y = (num(attr(full, "y")) ?? 0) + dy;
      const w = num(attr(full, "width")) ?? 0;
      const h = num(attr(full, "height")) ?? 0;
      checkBounds(x, y, w, h, canvasW, canvasH, loc, issues);
    } else if (name === "circle") {
      const cx = (num(attr(full, "cx")) ?? 0) + dx;
      const cy = (num(attr(full, "cy")) ?? 0) + dy;
      const r = num(attr(full, "r")) ?? 0;
      checkBounds(cx - r, cy - r, r * 2, r * 2, canvasW, canvasH, loc, issues);
    } else if (name === "ellipse") {
      const cx = (num(attr(full, "cx")) ?? 0) + dx;
      const cy = (num(attr(full, "cy")) ?? 0) + dy;
      const rx = num(attr(full, "rx")) ?? 0;
      const ry = num(attr(full, "ry")) ?? 0;
      checkBounds(
        cx - rx,
        cy - ry,
        rx * 2,
        ry * 2,
        canvasW,
        canvasH,
        loc,
        issues,
      );
    } else if (name === "line") {
      const x1 = (num(attr(full, "x1")) ?? 0) + dx;
      const y1 = (num(attr(full, "y1")) ?? 0) + dy;
      const x2 = (num(attr(full, "x2")) ?? 0) + dx;
      const y2 = (num(attr(full, "y2")) ?? 0) + dy;
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      checkBounds(minX, minY, w, h, canvasW, canvasH, loc, issues);
    } else if (name === "text") {
      const x = (num(attr(full, "x")) ?? 0) + dx;
      const y = (num(attr(full, "y")) ?? 0) + dy;
      const fontSize = num(attr(full, "font-size")) ?? 16;
      const content = tagContent(svg, full, match.index);
      const estWidth = estimateTextWidthPx(content, fontSize);
      // 多行文本：text 内容中以 <tspan 分隔的行数（含首行），行高按 1.2em 估算
      const rawContent = tagRawContent(svg, full, match.index);
      const tspans = (rawContent.match(/<tspan/gi) ?? []).length;
      const lineCount = Math.max(tspans + 1, 1);
      const estHeight = lineCount * fontSize * 1.2;
      if (x < 0 || y < 0 || x + estWidth > canvasW) {
        issues.push({
          severity: "error",
          message: `text 越界：x=${x}, y=${y}, 估算宽度=${estWidth.toFixed(0)} 超出画布宽度 ${canvasW}`,
          location: loc,
        });
      }
      if (y + estHeight > canvasH) {
        issues.push({
          severity: "error",
          message: `text 下越界：y+height=${(y + estHeight).toFixed(0)} (${lineCount} 行 × ${fontSize}px) > 画布高度 ${canvasH}`,
          location: loc,
        });
      }
      if (estWidth > canvasW) {
        issues.push({
          severity: "warn",
          message: `text 字号预算溢出：估算宽度 ${estWidth.toFixed(0)} 超过画布宽度 ${canvasW}`,
          location: loc,
        });
      }
    }
  }

  return issues;
}

/** 提取 SVG 中所有 <text> 文本节点的纯文本（去标签、保留空白原文） */
export function extractSvgTexts(svg: string): string[] {
  const texts: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const inner = m[1].replace(/<[^>]+>/g, "").trim();
    if (inner) texts.push(inner);
  }
  return texts;
}

/** 图表标记约定的合法类型（与 pptx-translator/chart.ts VALID_CHART_TYPES 保持一致） */
const VALID_CHART_TYPES = new Set([
  "area",
  "bar",
  "bar3D",
  "doughnut",
  "line",
  "pie",
  "radar",
]);

/** 提取属性值：值内含 JSON 等引号字符时用配对引号取完整内容（外层引号约定单引号） */
function attrQuoted(part: string, name: string): string | undefined {
  const m = part.match(new RegExp(`${name}\\s*=\\s*(['"])[\\s\\S]*?\\1`, "i"));
  if (!m) return undefined;
  const value = m[0].slice(m[0].indexOf("=") + 1).trim();
  return value.slice(1, -1);
}

/** SVG 中是否存在携带 data-chart-type 的原生图表元素 */
export function svgContainsChart(svg: string): boolean {
  return /<g[^>]*data-chart-type\s*=/i.test(svg);
}

/**
 * 图表数据校验：LLM 渲染了图表标记（data-chart-type）但数据缺失/损坏时，
 * 导出端 translateChart 会静默跳过整张图，因此在这里就拦下重画。
 * 只校验「已声明的图表」是否自带可用数据，不校验图表位置/尺寸。
 */
export function checkChartData(svg: string): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const re = /<g([^>]*data-chart-type[^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    const attrs = match[1];
    const type = attr(attrs, "data-chart-type");
    if (!type || !VALID_CHART_TYPES.has(type)) {
      issues.push({
        severity: "error",
        message: `图表类型非法：data-chart-type="${type ?? ""}"（支持 ${[...VALID_CHART_TYPES].join("/")}）`,
        location: "g",
      });
      continue;
    }
    const raw = attrQuoted(attrs, "data-chart-data");
    if (raw === undefined || raw === "") {
      issues.push({
        severity: "error",
        message: `图表缺少数据：data-chart-data 未提供（${type} 图将无法导出）`,
        location: "g",
      });
      continue;
    }
    let points: unknown;
    try {
      points = JSON.parse(raw);
    } catch {
      issues.push({
        severity: "error",
        message: `图表数据非法 JSON：data-chart-data 无法解析（${type} 图将无法导出）`,
        location: "g",
      });
      continue;
    }
    if (!Array.isArray(points) || points.length === 0) {
      issues.push({
        severity: "error",
        message: `图表数据为空：data-chart-data 需为包含 label/value 的非空数组（${type} 图将无法导出）`,
        location: "g",
      });
    }
  }
  return issues;
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, "");
}

/** 近似判断 needle 是否作为一个有意义的片段出现在 haystack 中（容忍改写字词） */
function containsFragment(haystack: string, needle: string): boolean {
  const h = collapseWs(haystack);
  const n = collapseWs(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  // 启发式回退：取 needle 的最大有效子串（≥1/2 长度且 ≥ 4 字符）做包含检查，
  // 容忍 LLM 在标题/要点中插入谓语或删减，但大面积缺失仍判缺失。
  const half = Math.max(4, Math.floor(n.length / 2));
  for (let i = 0; i + half <= n.length; i++) {
    if (h.includes(n.slice(i, i + half))) return true;
  }
  return false;
}

export interface ContentPresence {
  /** 页面标题：生成提示词强制完整呈现，缺失视为内容泄漏 */
  title?: string;
  /** 要点列表：任意一条缺失视为内容泄漏（有明确对应关系） */
  bullets?: string[];
  /** 关键数据/引用（quote 页正文），可选 */
  assert?: string[];
}

/**
 * 内容必现性校验：验证生成结果中没有「丢字、改字、编数据」造成目标内容缺漏。
 * 仅返回缺失项；语义改写（足以表达原意）不算缺失。
 */
export function checkContentPresence(
  svg: string,
  content?: ContentPresence,
): SvgIssue[] {
  if (!content) return [];
  const texts = extractSvgTexts(svg);
  const haystack = texts.join(" ");
  const issues: SvgIssue[] = [];

  if (content.title) {
    let found = false;
    for (const t of texts) {
      if (containsFragment(t, content.title)) {
        found = true;
        break;
      }
    }
    if (!found) {
      issues.push({
        severity: "error",
        message: `内容缺失：标题「${content.title}」未出现在 SVG 文本中`,
        location: "text",
      });
    }
  }

  for (const bullet of content.bullets ?? []) {
    if (!bullet.trim()) continue;
    if (!containsFragment(haystack, bullet)) {
      issues.push({
        severity: "error",
        message: `内容缺失：要点「${bullet.slice(0, 40)}」未出现在 SVG 文本中`,
        location: "text",
      });
    }
  }

  for (const assert of content.assert ?? []) {
    if (!assert.trim()) continue;
    if (!containsFragment(haystack, assert)) {
      issues.push({
        severity: "warn",
        message: `内容缺失：关键片段「${assert.slice(0, 40)}」未出现在 SVG 文本中`,
        location: "text",
      });
    }
  }

  return issues;
}

function checkBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number,
  loc: string,
  issues: SvgIssue[],
): void {
  if (x < 0) {
    issues.push({
      severity: "error",
      message: `元素越界：左边界 x=${x} < 0`,
      location: loc,
    });
  }
  if (y < 0) {
    issues.push({
      severity: "error",
      message: `元素越界：上边界 y=${y} < 0`,
      location: loc,
    });
  }
  if (x + w > canvasW) {
    issues.push({
      severity: "error",
      message: `元素超出右边界：x+width=${x + w} > ${canvasW}`,
      location: loc,
    });
  }
  if (y + h > canvasH) {
    issues.push({
      severity: "error",
      message: `元素超出下边界：y+height=${y + h} > ${canvasH}`,
      location: loc,
    });
  }
}

// ---- 字号锚点（参照 PPT Master typography anchors）----

/** 字号锚点容差：锚点值 ±2px 内视为一致 */
export const FONT_SIZE_ANCHOR_TOLERANCE_PX = 2;
/** 每页偏离锚点的稀疏例外上限（装饰性字号），超出才告警 */
export const SPARSE_OFF_ANCHOR_MAX = 2;

/** 提取 SVG 中所有显式 font-size 值（text/tspan） */
export function extractFontSizes(svg: string): number[] {
  const sizes: number[] = [];
  const re = /<(?:text|tspan)\b[^>]*\bfont-size\s*=\s*["']?(\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const v = Number.parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0) sizes.push(v);
  }
  return sizes;
}

/**
 * 字号锚点校验：页面上除稀疏例外（≤2 处装饰性字号）外，
 * 所有 font-size 都必须落在锚点 ±2px 内。跨页同层级字号一致是
 * AI 生成 deck 最易穿帮的破绽，此规则为 cohort 一致性门提供依据。
 */
export function checkTypographyAnchors(
  svg: string,
  specLock: SpecLock,
): SvgIssue[] {
  const anchors = specLock.typography;
  if (!anchors) return [];
  const anchorValues = Object.values(anchors);
  const offAnchor = extractFontSizes(svg).filter(
    (size) =>
      !anchorValues.some(
        (a) => Math.abs(a - size) <= FONT_SIZE_ANCHOR_TOLERANCE_PX,
      ),
  );
  if (offAnchor.length <= SPARSE_OFF_ANCHOR_MAX) return [];
  const uniq = [...new Set(offAnchor)].sort((a, b) => a - b);
  return [
    {
      severity: "warn",
      message: `字号偏离锚点：${uniq.join("/")}px 不在锚点 ${anchorValues.join("/")} ±${FONT_SIZE_ANCHOR_TOLERANCE_PX}px 内（${offAnchor.length} 处），请统一到锚点字号`,
      location: "text",
    },
  ];
}

// ---- cohort 一致性门（early gate，参照 PPT Master P01-P05 early gate）----

/**
 * 跨页一致性检查：对已生成的一组页面做系统性校验——
 * 颜色/字体是否越出设计锁、字号是否遵循锚点。
 * 单页检查无法发现的「整体走样」在这里拦截。
 */
export function checkCohortConsistency(
  svgs: string[],
  specLock: SpecLock,
): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const allowedColors = new Set(
    Object.values(specLock.colors).map((c) => c.replace("#", "").toUpperCase()),
  );
  const allowedFonts = new Set(
    Object.values(specLock.fonts).map((f) => f.toLowerCase()),
  );

  const colorCounts = new Map<string, number>();
  const fontCounts = new Map<string, number>();
  for (const svg of svgs) {
    // 颜色：hex 字面量（渐变 stop/填充/描边）
    const hexes = svg.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
    for (const raw of hexes) {
      const hex = raw.replace("#", "").toUpperCase();
      colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
    }
    const fonts = svg.match(/font-family\s*=\s*["']([^"']+)["']/gi) ?? [];
    for (const f of fonts) {
      const name = (f.split("=")[1] ?? "").replace(/["']/g, "").trim();
      if (name) fontCounts.set(name, (fontCounts.get(name) ?? 0) + 1);
    }
  }

  const offColors = [...colorCounts.entries()]
    .filter(([hex]) => !allowedColors.has(hex))
    .sort((a, b) => b[1] - a[1]);
  if (offColors.length > 0) {
    issues.push({
      severity: "error",
      message: `配色越锁：使用了设计锁之外的颜色 ${offColors
        .slice(0, 3)
        .map(([hex, n]) => `#${hex}(×${n})`)
        .join("、")}，只允许使用配色表中的颜色`,
      location: "cohort",
    });
  }

  const offFonts = [...fontCounts.entries()].filter(
    ([name]) => !allowedFonts.has(name.toLowerCase()),
  );
  if (offFonts.length > 0) {
    issues.push({
      severity: "error",
      message: `字体越锁：使用了 ${offFonts
        .slice(0, 3)
        .map(([name]) => name)
        .join("、")}，只允许 ${[...allowedFonts].join(" / ")}`,
      location: "cohort",
    });
  }

  for (const svg of svgs) {
    issues.push(...checkTypographyAnchors(svg, specLock));
  }

  return issues;
}

// ---- 预设形状词表校验（data-prst）----

/** 校验 data-prst 值是否在支持列表内：未知值导出端会静默降级为包围盒矩形，在此拦下重画 */
export function checkPresetShapes(svg: string): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const re = /\bdata-prst\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(svg)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    if (!isPresetShape(id)) {
      issues.push({
        severity: "error",
        message: `预设形状非法：data-prst="${id}" 不在支持列表（${Object.keys(PRESET_SHAPES).join("/")}）`,
        location: "data-prst",
      });
    }
  }
  return issues;
}

// ---- 内置图标词表校验（data-icon，C1）----

/** 校验 data-icon 值是否在图标库内：未知 id 导出端会降级为矩形，在此拦下重画 */
export function checkSvgIcons(svg: string): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const re = /\bdata-icon\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(svg)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    if (!isIcon(id)) {
      issues.push({
        severity: "error",
        message: `图标非法：data-icon="${id}" 不在图标库（${Object.keys(ICONS).join("/")}）`,
        location: "data-icon",
      });
    }
  }
  return issues;
}

// ---- 文本几何确定性检测（参照 PPT Master 文本测量校准的校验侧）----

interface TextBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  snippet: string;
  loc: string;
  /** 字号 px（S1 行距、S6 字距阈值需要） */
  fontSize: number;
  /** 首行基线 y（= 元素 y + translate dy） */
  baseline: number;
  /** letter-spacing 属性值（px），缺省 undefined */
  letterSpacing?: number;
  /** 首个 <tspan> 之外的直接文本行数（1 或 0）——用于 S1 块内基线 */
  lineCount: number;
}

/**
 * 收集所有 <text> 的估算包围盒（含 text-anchor 与多行 tspan）：
 * y 视为首行基线，首行顶 = y − 0.85em，行高 1.2em。
 */
function collectTextBoxes(svg: string): TextBox[] {
  const boxes: TextBox[] = [];
  const re = /<text\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const full = m[0];
    const { dx, dy } = translateOffset(full);
    const x = (num(attr(full, "x")) ?? 0) + dx;
    const y = (num(attr(full, "y")) ?? 0) + dy;
    const fontSize = num(attr(full, "font-size")) ?? 16;
    const content = tagContent(svg, full, m.index);
    if (!content.trim()) continue;
    const estWidth = estimateTextWidthPx(content, fontSize);
    const raw = tagRawContent(svg, full, m.index);
    const tspans = (raw.match(/<tspan/gi) ?? []).length;
    // 行首文本可能是 text 直排（首行不在 tspan 内）也可能全在 tspan 里
    //（renderFittedText 的写法）：按 text 内 tspan 之外的残留文本判定行数。
    const outsideTspan = raw
      .replace(/<tspan[\s\S]*?<\/tspan>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    const lineCount = Math.max(tspans > 0 ? tspans + (outsideTspan ? 1 : 0) : 1, 1);
    const anchor = attr(full, "text-anchor");
    let left = x;
    if (anchor === "middle") left = x - estWidth / 2;
    else if (anchor === "end") left = x - estWidth;
    boxes.push({
      left,
      right: left + estWidth,
      top: y - fontSize * 0.85,
      bottom: y + (lineCount - 1) * fontSize * 1.2 + fontSize * 0.25,
      snippet: content.slice(0, 16),
      loc: `text@${m.index}`,
      fontSize,
      baseline: y,
      letterSpacing: num(attr(full, "letter-spacing")),
      lineCount,
    });
    // 游标停在 openTag 之后，避免重复匹配同一元素内容里的 tspan
    re.lastIndex = m.index + full.length;
  }
  return boxes;
}

/**
 * 文本几何校验：小模型页面崩坏两大形态——贴边/越安全区、文字两两重叠。
 * 这两类错误此前 checkSvg 看不见（只查画布外沿），修复循环因此空转。
 * 安全区：左右下各留画布宽 2.5%（1280 → 32px），标题带等贴边设计
 * 允许压线但不得越线；重叠：横向交叠 >20% 且纵向交叠 >40% 判错。
 */
export function checkTextGeometry(svg: string, specLock: SpecLock): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const { w: canvasW, h: canvasH } = specLock.canvas;
  const safe = Math.round(canvasW * 0.025);
  const boxes = collectTextBoxes(svg);

  for (const b of boxes) {
    if (b.right > canvasW - safe * 0.5) {
      issues.push({
        severity: "error",
        message: `文字「${b.snippet}」右缘到达 ${b.right.toFixed(0)}，越出安全区（画布 ${canvasW} − 安全边距 ${safe}）：缩短文字或换行`,
        location: b.loc,
      });
    }
    if (b.left < safe * 0.5) {
      issues.push({
        severity: "error",
        message: `文字「${b.snippet}」左缘 ${b.left.toFixed(0)} 越出安全区（< ${Math.round(safe * 0.5)}）`,
        location: b.loc,
      });
    }
    if (b.bottom > canvasH - safe * 0.5) {
      issues.push({
        severity: "error",
        message: `文字「${b.snippet}」底缘 ${b.bottom.toFixed(0)} 越出下安全区（画布 ${canvasH} − ${safe}）`,
        location: b.loc,
      });
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const c = boxes[j];
      const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
      const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ox <= 0 || oy <= 0) continue;
      const minW = Math.min(a.right - a.left, c.right - c.left);
      const minH = Math.min(a.bottom - a.top, c.bottom - c.top);
      if (ox > minW * 0.2 && oy > minH * 0.4) {
        issues.push({
          severity: "error",
          message: `文字重叠：「${a.snippet}」与「${c.snippet}」包围盒交叠 ${ox.toFixed(0)}×${oy.toFixed(0)}px，调整间距或缩短文字`,
          location: c.loc,
        });
      }
    }
  }
  return issues;
}

// ---- 量化美学规则（参照 PPT Master 60-30-10 / WCAG / 阴影参数域）----

function normalizeHex(c: string | undefined): string | undefined {
  if (!c) return undefined;
  const m = c.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return undefined;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((x) => x + x).join("");
  return hex.toUpperCase();
}

function luminance(hex: string): number {
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG 对比度（1..21） */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

interface FilledRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  index: number;
}

function collectFilledRects(svg: string): FilledRect[] {
  const rects: FilledRect[] = [];
  const re = /<rect\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const { dx, dy } = translateOffset(m[0]);
    const fill = normalizeHex(attr(m[0], "fill"));
    if (!fill) continue;
    const w = num(attr(m[0], "width")) ?? 0;
    const h = num(attr(m[0], "height")) ?? 0;
    if (w <= 0 || h <= 0) continue;
    rects.push({
      x: (num(attr(m[0], "x")) ?? 0) + dx,
      y: (num(attr(m[0], "y")) ?? 0) + dy,
      w,
      h,
      fill,
      index: m.index,
    });
  }
  return rects;
}

/**
 * 量化美学校验：
 * 1) 文字与其直接底面色块的 WCAG 对比度——正文 <4.5、大字(<26px 以下按小字) 
 *    与 ≥26px 大字 <3.0 判 error（小模型最爱干的事就是浅字压浅底）；
 * 2) 60-30-10 色比例——accent 着色面积 >12% 画布 warn、页面缺底色 warn；
 * 3) 阴影参数域——flood-opacity 落在 0.03–0.12 之外 warn。
 */
export function checkAesthetics(svg: string, specLock: SpecLock): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const { w: canvasW, h: canvasH } = specLock.canvas;
  const canvasArea = canvasW * canvasH;
  const rects = collectFilledRects(svg);

  // 1) 对比度
  const textRe = /<text\b[^>]*>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = textRe.exec(svg)) !== null) {
    const open = tm[0];
    const fill = normalizeHex(attr(open, "fill"));
    if (!fill) continue;
    const { dx, dy } = translateOffset(open);
    const tx = (num(attr(open, "x")) ?? 0) + dx;
    const ty = (num(attr(open, "y")) ?? 0) + dy;
    const fs = num(attr(open, "font-size")) ?? 16;
    // 文档序最靠后（画在最上）且覆盖文字中心的矩形视为底面
    let bg: string | undefined;
    for (const r of rects) {
      if (r.index >= tm.index) break;
      if (r.x <= tx && tx <= r.x + r.w && r.y <= ty && ty <= r.y + r.h) {
        bg = r.fill;
      }
    }
    if (!bg) bg = normalizeHex(specLock.colors.background);
    if (!bg || bg === fill) continue;
    const min = fs >= 26 ? 3.0 : 4.5;
    const ratio = contrastRatio(fill, bg);
    if (ratio < min) {
      // 处置分级（对标 brand-token vs 单页越位）：文字色与底面色都是色板
      // token → 整份 deck 的系统问题（brand），单页模型无法逐页修；
      // 否则是单页越位用色（page），可加 scrim / 抬字号 / 换 token 修。
      const tokens = paletteTokenHexes(specLock);
      const bothTokens = tokens.has(fill) && tokens.has(bg);
      issues.push({
        severity: "error",
        kind: bothTokens ? "brand" : "page",
        message: bothTokens
          ? `配色组合不达标：token #${fill} 文字压在 #${bg} 上对比度 ${ratio.toFixed(2)} < ${min}——这是整份 deck 的设计问题，逐页重画无效，请在设计面板更换文字/底色 token`
          : `对比度不足：文字（#${fill}）与其底面（#${bg}）对比度 ${ratio.toFixed(2)} < ${min}——请改用配色表中对比更强的组合，或在文字下垫 background/surface scrim，或把字号抬到 ≥26px`,
        location: `text@${tm.index}`,
      });
    }
  }

  // 2) 60-30-10：accent 面积比例 + 页面底色
  const accentHex = normalizeHex(specLock.colors.accent);
  if (accentHex) {
    const accentArea = rects
      .filter((r) => r.fill === accentHex)
      .reduce((s, r) => s + Math.min(r.w * r.h, canvasArea), 0);
    const pct = (accentArea / canvasArea) * 100;
    if (pct > 12) {
      issues.push({
        severity: "warn",
        message: `强调色面积 ${pct.toFixed(0)}%，超出 60-30-10 配色的 10% 上限——accent 只用于点睛，大面积请换 background/surface`,
        location: "color-ratio",
      });
    }
  }
  const baseHex = normalizeHex(specLock.colors.background);
  const hasBase = rects.some(
    (r) => r.fill === baseHex && r.w * r.h >= canvasArea * 0.4,
  );
  if (baseHex && !hasBase) {
    issues.push({
      severity: "warn",
      message: `页面缺少大面积底色（background ${specLock.colors.background} 覆盖 <40%），画面发飘`,
      location: "color-ratio",
    });
  }

  // 3) 阴影参数域
  const floodRe = /flood-opacity\s*=\s*["']?([0-9.]+)/gi;
  let fm: RegExpExecArray | null;
  while ((fm = floodRe.exec(svg)) !== null) {
    const v = Number.parseFloat(fm[1]);
    if (!Number.isFinite(v)) continue;
    if (v > 0.12 || v < 0.03) {
      issues.push({
        severity: "warn",
        message: `阴影浓度 flood-opacity=${v} 超出参数域 0.03–0.12，AI 感重，请调淡`,
        location: "shadow",
      });
    }
  }
  return issues;
}

/**
 * 图表几何回算（参照 PPT Master verify-charts 的坐标反算思路）：
 * 柱图（bar/bar3D）中模型手绘的柱体 rect 必须与 data-chart-data 对得上——
 * 数量一致、柱高比例与数值比例误差 ≤12%，否则预览图会「看着对、量不对」。
 * （导出端会用原生图表重绘，此校验保的是设计真相 SVG 本身。）
 */
export function checkChartGeometry(svg: string): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const re = /<g\b[^>]*data-chart-type\s*=\s*["'](bar3D|bar)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[0];
    const raw = attrQuoted(attrs, "data-chart-data");
    if (!raw) continue;
    let points: { value: number }[];
    try {
      points = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(points) || points.length === 0) continue;
    const closeIdx = svg.indexOf("</g>", m.index);
    const inner = closeIdx > m.index ? svg.slice(m.index + m[0].length, closeIdx) : "";
    const barRe = /<rect\b[^>]*>/gi;
    let bm: RegExpExecArray | null;
    const bars: { x: number; h: number }[] = [];
    let innerArea = 0;
    while ((bm = barRe.exec(inner)) !== null) {
      const w = num(attr(bm[0], "width")) ?? 0;
      const h = num(attr(bm[0], "height")) ?? 0;
      if (h <= 0 || w <= 0) continue;
      innerArea = Math.max(innerArea, w * h);
      bars.push({ x: (num(attr(bm[0], "x")) ?? 0), h });
    }
    // 排除铺底大矩形（面积取柱内最大者 3 倍以上视为背景板）
    const cap = innerArea * 3;
    const cols = bars
      .filter((b) => b.h * b.h < cap * 4)
      .sort((a, b) => a.x - b.x);
    if (cols.length === 0) continue; // 没画柱体：图表数据仍在，导出兜底
    if (cols.length !== points.length) {
      issues.push({
        severity: "error",
        message: `柱图几何不符：画了 ${cols.length} 根柱但数据有 ${points.length} 个点，请重画`,
        location: "g",
      });
      continue;
    }
    const maxV = Math.max(...points.map((p) => Math.abs(p.value ?? 0)));
    const maxH = Math.max(...cols.map((b) => b.h));
    if (maxV <= 0 || maxH <= 0) continue;
    for (let i = 0; i < cols.length; i++) {
      const vr = Math.abs(points[i].value) / maxV;
      const hr = cols[i].h / maxH;
      if (Math.abs(vr - hr) > 0.12) {
        issues.push({
          severity: "error",
          message: `柱图几何失真：第 ${i + 1} 根柱高度比例 ${(hr * 100).toFixed(0)}% 与数值比例 ${(vr * 100).toFixed(0)}% 偏差超过 12%，请按数据重算柱高`,
          location: "g",
        });
        break;
      }
    }
  }
  return issues;
}

/**
 * 版面失衡统计（视觉评审的确定性替代——不渲染 PNG，直接对几何做统计）：
 * 1) 内容整体缩在上部（底部 >38% 画布空白且内容未下沉）warn；
 * 2) 左缘对齐碎片化：>4 个互不相邻的左缘值 warn（应吸附到统一栏格）。
 */
export function checkLayoutBalance(svg: string, specLock: SpecLock): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const { w: canvasW, h: canvasH } = specLock.canvas;
  const rects = collectFilledRects(svg).filter(
    (r) => r.w * r.h < canvasW * canvasH * 0.85,
  );
  const boxes = collectTextBoxes(svg);
  if (boxes.length === 0 && rects.length === 0) return issues;

  let contentBottom = 0;
  let contentTop = canvasH;
  for (const r of rects) {
    contentTop = Math.min(contentTop, r.y);
    contentBottom = Math.max(contentBottom, r.y + r.h);
  }
  for (const b of boxes) {
    contentTop = Math.min(contentTop, b.top);
    contentBottom = Math.max(contentBottom, b.bottom);
  }
  const bottomGapRatio = (canvasH - contentBottom) / canvasH;
  if (
    Number.isFinite(bottomGapRatio) &&
    bottomGapRatio > 0.38 &&
    contentTop < canvasH * 0.3 &&
    boxes.length >= 3
  ) {
    issues.push({
      severity: "warn",
      message: `版面失衡：底部 ${Math.round(bottomGapRatio * 100)}% 空白且内容全部堆积在上半部，请加大行距/分布或下移视觉重心`,
      location: "balance",
    });
  }

  const lefts = boxes
    .map((b) => Math.round(b.left))
    .filter((x) => x > 0 && x < canvasW * 0.8);
  const clusters: number[] = [];
  for (const x of lefts.sort((a, b) => a - b)) {
    if (clusters.length === 0 || x - clusters[clusters.length - 1] > 6) {
      clusters.push(x);
    }
  }
  if (clusters.length > 4) {
    issues.push({
      severity: "warn",
      message: `左缘对齐碎片化：出现 ${clusters.length} 个不同左缘（${clusters.slice(0, 6).join("/")}px），文本请吸附到统一栏位 x（如边距 40 或各栏起始）`,
      location: "balance",
    });
  }
  return issues;
}

// ---- 色板 token 归类 / 视觉节奏 / 确定性原子修复（对标 PPT Master brand escalation）----

/** 该页配色表里的合法 token 值集合（大写、已归一的 HEX，不含 3 位写法）。 */
export function paletteTokenHexes(specLock: SpecLock): Set<string> {
  const c = specLock.colors;
  const out = new Set<string>();
  for (const raw of [
    c.primary,
    c.secondary,
    c.accent,
    c.background,
    c.surface,
    c.text,
    c.textMuted,
  ]) {
    const h = normalizeHex(raw);
    if (h) out.add(h);
  }
  return out;
}

/** 取 token 集合中离 hex 最近者（RGB 欧氏距离）；集合空则返回原值。 */
export function nearestTokenHex(
  hex: string,
  tokens: Set<string>,
): string {
  const withHash = hex.trim().startsWith("#") ? hex.trim() : "#" + hex.trim();
  const n = normalizeHex(withHash);
  if (!n || tokens.size === 0) return hex;
  if (tokens.has(n)) return "#" + n;
  const to = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = to(n);
  let best = n;
  let bestD = Infinity;
  for (const t of tokens) {
    const [tr, tg, tb] = to(t);
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return "#" + best;
}

/**
 * 视觉节奏统计（对标 visual-review.md 的纯几何可算软规则 S4/S5/S6）：
 * 全部 warn（提示级），不阻断导出；供质量面板与首屏一致性纠正消费。
 * - S6 CJK 字距：letter-spacing / font-size > 5%（小模型常乱加字距）
 * - S4 对齐漂移：两个本应同栏的 <text> 左缘相差 4–24px（近似对齐却没吸附）
 * - S5 栅格不均：同 y 带的卡片 rect 相邻 x 间距差异 >5%
 */
export function checkVisualRhythm(
  svg: string,
  specLock: SpecLock,
): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const { w: canvasW } = specLock.canvas;

  // S6：CJK 字距超标
  const lsRe =
    /<(text|tspan)\b[^>]*\bletter-spacing\s*=\s*["']?(-?[\d.]+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = lsRe.exec(svg)) !== null) {
    const ls = Number.parseFloat(lm[2]);
    if (!Number.isFinite(ls) || ls <= 0) continue;
    const fs = num(attr(lm[0], "font-size")) ?? 16;
    const text = lm[3].replace(/<[^>]+>/g, "");
    const hasCjk = [...text].some((ch) => ch.charCodeAt(0) > 0x2e80);
    if (hasCjk && ls / fs > 0.05) {
      issues.push({
        severity: "warn",
        message: `CJK 字距过大：letter-spacing=${ls} 为字号 ${fs} 的 ${((ls / fs) * 100).toFixed(0)}%（>5%），中文不加字距，请移除 letter-spacing`,
        location: "letter-spacing",
      });
    }
  }

  // S4：同栏左缘近似对齐却漂移（4–24px）——只报最典型的一对，避免刷屏
  const boxes = collectTextBoxes(svg);
  const lefts = boxes
    .map((b) => b.left)
    .filter((x) => x > canvasW * 0.02 && x < canvasW * 0.8);
  let driftFound = false;
  for (let i = 0; i < lefts.length && !driftFound; i++) {
    for (let j = i + 1; j < lefts.length; j++) {
      const d = Math.abs(lefts[i] - lefts[j]);
      if (d >= 4 && d <= 24) {
        issues.push({
          severity: "warn",
          message: `左缘对齐漂移：两处文本左缘相差 ${d.toFixed(0)}px（≥4 且 ≤24），像同一栏却没吸附，请统一到同一栏位 x（如 40/边距）`,
          location: "alignment",
        });
        driftFound = true;
        break;
      }
    }
  }

  // S5：同 y 带卡片相邻间距不均（>5%）
  const rects = collectFilledRects(svg).filter(
    (r) => r.w > canvasW * 0.05 && r.w < canvasW * 0.6 && r.h > 40,
  );
  const bands = new Map<number, FilledRect[]>();
  for (const r of rects) {
    const key = Math.round(r.y / 20);
    const arr = bands.get(key) ?? [];
    arr.push(r);
    bands.set(key, arr);
  }
  for (const arr of bands.values()) {
    if (arr.length < 3) continue;
    const sorted = [...arr].sort((a, b) => a.x - b.x);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w));
    }
    if (gaps.some((g) => g < 0)) continue; // 有重叠不算均分栅格
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avg <= 0) continue;
    const spread = (Math.max(...gaps) - Math.min(...gaps)) / avg;
    if (spread > 0.05) {
      issues.push({
        severity: "warn",
        message: `同排 ${arr.length} 张卡片间距不均（最大/最小差 ${(spread * 100).toFixed(0)}%），请等分 x 间距`,
        location: "grid",
      });
    }
  }

  return issues;
}

/**
 * 确定性原子修复（对标 §4.2/4.3 的「代码直接 patch，一次一处，净误差数下降才保留」）：
 * 只做纯属性改写、绝不改变几何结构，因此不可能引入新的越界/重叠：
 * 1) 非色板 HEX → 吸附到最近色板 token（小模型最高频的「乱用色」）
 * 2) CJK letter-spacing 超标 → 移除该属性（仅当该元素正文含 CJK）
 * 返回 patch 后的 svg 与变更条数；调用方以「修复后 error 数 < 修复前」决定是否保留。
 */
export function autoPatchSvg(
  svg: string,
  specLock: SpecLock,
): { svg: string; changed: number } {
  const tokens = paletteTokenHexes(specLock);
  let changed = 0;

  // 1) 颜色吸附：fill / stroke / stop-color 上的非 token HEX
  let out = svg;
  if (tokens.size > 0) {
    out = out.replace(
      /\b(fill|stroke|stop-color)\s*=\s*["']#([0-9a-fA-F]{3,6})["']/g,
      (m, name: string, hex: string) => {
        const n = normalizeHex("#" + hex);
        if (!n || tokens.has(n)) return m;
        changed++;
        return `${name}="${nearestTokenHex(n, tokens)}"`;
      },
    );
  }

  // 2) CJK 字距移除：逐个 <text>/<tspan> 元素块扫描，按块内正文判定
  out = out.replace(
    /<(text|tspan)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (m, tag: string, attrs: string, inner: string) => {
      const lsRaw = attr(attrs, "letter-spacing");
      if (lsRaw == null) return m;
      const ls = Number.parseFloat(lsRaw);
      if (!Number.isFinite(ls) || ls <= 0) return m;
      const fs = num(attr(attrs, "font-size")) ?? 16;
      const content = inner.replace(/<[^>]+>/g, "");
      const hasCjk = [...content].some((ch) => ch.charCodeAt(0) > 0x2e80);
      if (!hasCjk || ls / fs <= 0.05) return m;
      changed++;
      const strippedAttrs = attrs.replace(
        /\s*\bletter-spacing\s*=\s*["']?-?[\d.]+["']?/i,
        "",
      );
      return `<${tag}${strippedAttrs}>${inner}</${tag}>`;
    },
  );

  return { svg: out, changed };
}

/**
 * 色板 token 组合的静态对比度体检（对标 brand escalation §1.1）：
 * 文字类 token（text / textMuted）压在底色类 token（background / surface）上，
 * 只要某组合 <4.5 就是整份 deck 的系统性可读性问题——逐页重画改不动，
 * 应在设计面板更换 token。返回 warn 级、deck 级（无页位置）单条。
 */
export function checkPaletteContrast(specLock: SpecLock): SvgIssue[] {
  const c = specLock.colors;
  const fg: [string, string][] = [
    ["text", c.text],
    ["textMuted", c.textMuted],
  ];
  const bg: [string, string][] = [
    ["background", c.background],
    ["surface", c.surface],
  ];
  const issues: SvgIssue[] = [];
  for (const [fn, f] of fg) {
    for (const [bn, b] of bg) {
      const fh = normalizeHex(f);
      const bh = normalizeHex(b);
      if (!fh || !bh) continue;
      const ratio = contrastRatio(fh, bh);
      if (ratio < 4.5) {
        issues.push({
          severity: "warn",
          kind: "brand",
          message: `配色 token 组合「${fn} ${f}」压在「${bn} ${b}」上对比度 ${ratio.toFixed(2)} < 4.5，全 deck 该组合都会发虚——请在设计面板调深文字或提亮底色`,
          location: "palette",
        });
      }
    }
  }
  return issues;
}
