import type { SpecLock } from "@/design/spec-lock";
import { isPresetShape, PRESET_SHAPES } from "../presets";
import { validateSvgContract } from "../spec-contract";

export type SvgIssue = {
  severity: "error" | "warn";
  message: string;
  location?: string;
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
 * 估算文本宽度（viewBox 像素，与其 translator 的 glyphWidthPx 口径一致）：
 * CJK 全角字符按 1.0 字号、其余按 0.55 字号近似。
 * 中文文本若沿用 0.6 常数会严重低估，导致溢出文本漏检。
 */
export function estimateTextWidthPx(text: string, fontSizePx: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55;
  }
  // +0.4em 尾距，防贴边裁切
  return Math.max(w + fontSizePx * 0.4, fontSizePx);
}

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
