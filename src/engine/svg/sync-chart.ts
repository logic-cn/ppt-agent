import type { ChartSpec } from "@/types/deck";
import type { SpecLock } from "@/design/spec-lock";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ChartGroup {
  start: number;
  end: number;
  attrs: string;
  inner: string;
}

export interface SyncChartResult {
  svg: string;
  synced: boolean;
}

export interface RemoveChartResult {
  svg: string;
  removed: boolean;
}

const DEFAULT_PALETTE = ["#2563EB", "#FACC15", "#22D3EE", "#8B5CF6", "#EA580C"];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function num(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? "";
  }
  return attrs;
}

function parseTranslate(transform: string | undefined): {
  dx: number;
  dy: number;
} | null {
  const match = transform?.match(
    /translate\(\s*([-0-9.]+)[ ,]+([-0-9.]+)\s*\)/,
  );
  if (!match) return null;
  return { dx: Number(match[1]) || 0, dy: Number(match[2]) || 0 };
}

/** 找到第一个 data-chart-type 的 <g>，按嵌套深度匹配闭合标签 */
function findChartGroup(svg: string): ChartGroup | null {
  const openRe = /<g\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(svg)) !== null) {
    if (!/\bdata-chart-type\s*=/.test(match[1])) continue;
    const start = match.index;
    const contentStart = openRe.lastIndex;
    let depth = 1;
    const tagRe = /<\/?g\b[^>]*>/gi;
    tagRe.lastIndex = contentStart;
    let tag: RegExpExecArray | null;
    while ((tag = tagRe.exec(svg)) !== null) {
      if (tag[0].startsWith("</")) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        return {
          start,
          end: tagRe.lastIndex,
          attrs: match[1],
          inner: svg.slice(contentStart, tag.index),
        };
      }
    }
  }
  return null;
}

function estimateContentBounds(inner: string): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number, w = 0, h = 0) => {
    if (![x, y, w, h].every(Number.isFinite)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + Math.max(0, w));
    maxY = Math.max(maxY, y + Math.max(0, h));
  };
  const elems =
    inner.match(
      /<(rect|circle|ellipse|line|text|polyline|polygon|path)\b[^>]*>/gi,
    ) ?? [];
  for (const elem of elems) {
    const tag = elem.match(/^<([a-z]+)/i)?.[1]?.toLowerCase();
    const a = parseAttrs(elem);
    if (tag === "rect") {
      const x = num(a.x) ?? 0;
      const y = num(a.y) ?? 0;
      add(x, y, num(a.width) ?? 0, num(a.height) ?? 0);
    } else if (tag === "circle") {
      const cx = num(a.cx) ?? 0;
      const cy = num(a.cy) ?? 0;
      const r = num(a.r) ?? 0;
      add(cx - r, cy - r, r * 2, r * 2);
    } else if (tag === "ellipse") {
      const cx = num(a.cx) ?? 0;
      const cy = num(a.cy) ?? 0;
      const rx = num(a.rx) ?? 0;
      const ry = num(a.ry) ?? 0;
      add(cx - rx, cy - ry, rx * 2, ry * 2);
    } else if (tag === "line") {
      const x1 = num(a.x1) ?? 0;
      const y1 = num(a.y1) ?? 0;
      const x2 = num(a.x2) ?? 0;
      const y2 = num(a.y2) ?? 0;
      add(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1),
      );
    } else if (tag === "text") {
      const x = num(a.x) ?? 0;
      const y = num(a.y) ?? 0;
      const size = num(a["font-size"]) ?? 14;
      add(x, y - size, Math.max(size, 40), size * 1.4);
    } else if (tag === "polyline" || tag === "polygon") {
      const points = (a.points ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter(Number.isFinite);
      for (let i = 0; i + 1 < points.length; i += 2) {
        add(points[i], points[i + 1]);
      }
    } else if (tag === "path") {
      const nums = (a.d ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        add(nums[i], nums[i + 1]);
      }
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  if (maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function clampBox(box: Box, canvas: { w: number; h: number }): Box {
  const margin = 8;
  const x = Math.min(
    Math.max(box.x, margin),
    Math.max(margin, canvas.w - margin - 80),
  );
  const y = Math.min(
    Math.max(box.y, margin),
    Math.max(margin, canvas.h - margin - 80),
  );
  const w = Math.max(80, Math.min(box.w, canvas.w - x - margin));
  const h = Math.max(80, Math.min(box.h, canvas.h - y - margin));
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

function resolveBox(group: ChartGroup, specLock: SpecLock): Box {
  const attrs = parseAttrs(group.attrs);
  const canvas = specLock.canvas;
  const translate = parseTranslate(attrs.transform);
  const x = num(attrs.x);
  const y = num(attrs.y);
  const w = num(attrs.width);
  const h = num(attrs.height);

  if (x != null && y != null && w != null && h != null) {
    return clampBox({ x, y, w, h }, canvas);
  }

  const content = estimateContentBounds(group.inner);
  if (content) {
    return clampBox(
      {
        x: content.x + (translate?.dx ?? 0) - 8,
        y: content.y + (translate?.dy ?? 0) - 8,
        w: content.w + 16,
        h: content.h + 16,
      },
      canvas,
    );
  }

  if (translate) {
    return clampBox(
      {
        x: translate.dx,
        y: translate.dy,
        w: Math.round(canvas.w * 0.8),
        h: Math.round(canvas.h * 0.6),
      },
      canvas,
    );
  }

  const margin = Math.round(canvas.w * 0.06);
  const top = Math.round(canvas.h * 0.2);
  return clampBox(
    {
      x: margin,
      y: top,
      w: canvas.w - margin * 2,
      h: canvas.h - top - margin,
    },
    canvas,
  );
}

function chartColors(specLock: SpecLock): string[] {
  const c = specLock.colors;
  return [c.primary, c.secondary, c.accent, c.text, c.textMuted].filter(
    (color): color is string => Boolean(color),
  );
}

function truncate(text: string, maxChars: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= maxChars) return text.trim();
  return `${chars.slice(0, Math.max(1, maxChars - 1)).join("")}…`;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function textEl(
  x: number,
  y: number,
  text: string,
  opts: {
    size: number;
    fill: string;
    font: string;
    anchor?: "start" | "middle" | "end";
    bold?: boolean;
  },
): string {
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : "";
  const weight = opts.bold ? ' font-weight="600"' : "";
  return (
    `<text x="${round(x)}" y="${round(y)}" font-family="${escapeXml(opts.font)}" ` +
    `font-size="${round(opts.size)}" fill="${escapeXml(opts.fill)}"${anchor}${weight}>` +
    `${escapeXml(text)}</text>`
  );
}

function renderChart(chart: ChartSpec, box: Box, specLock: SpecLock): string {
  const font = specLock.fonts.body || "sans-serif";
  const colors = chartColors(specLock);
  const palette = colors.length > 0 ? colors : DEFAULT_PALETTE;
  const body = specLock.typography?.body ?? 16;
  const labelSize = Math.max(10, Math.min(14, body - 3));
  const valueSize = Math.max(10, labelSize - 1);
  const titleSize = Math.max(13, Math.min(20, body));
  const data = chart.data.map((d) => ({
    label: String(d.label ?? ""),
    value: Number.isFinite(Number(d.value)) ? Number(d.value) : 0,
  }));

  const pad = 14;
  const titleH = chart.title?.trim() ? titleSize + 14 : 0;
  const plotX = box.x + pad;
  const plotY = box.y + pad + titleH;
  const plotW = Math.max(20, box.w - pad * 2);
  const plotH = Math.max(20, box.h - pad * 2 - titleH - 34);
  const plotBottom = plotY + plotH;

  const parts: string[] = [];
  if (chart.title?.trim()) {
    const maxChars = Math.max(4, Math.floor(plotW / (titleSize * 0.95)));
    parts.push(
      textEl(
        box.x + box.w / 2,
        box.y + pad + titleSize,
        truncate(chart.title, maxChars),
        {
          size: titleSize,
          fill: specLock.colors.text,
          font,
          anchor: "middle",
          bold: true,
        },
      ),
    );
  }

  if (data.length === 0) {
    parts.push(
      textEl(plotX + plotW / 2, plotY + plotH / 2, "—", {
        size: body,
        fill: specLock.colors.textMuted,
        font,
        anchor: "middle",
      }),
    );
    return parts.join("");
  }

  if (chart.type === "pie" || chart.type === "doughnut") {
    const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);
    const cx = plotX + plotW * 0.34;
    const cy = plotY + plotH / 2;
    const radius = Math.max(16, Math.min(plotW * 0.3, plotH * 0.46));
    if (total <= 0) {
      parts.push(
        textEl(cx, cy, "—", {
          size: body,
          fill: specLock.colors.textMuted,
          font,
          anchor: "middle",
        }),
      );
    } else {
      let angle = -Math.PI / 2;
      data.forEach((d, index) => {
        const slice = (Math.abs(d.value) / total) * Math.PI * 2;
        if (slice <= 0) return;
        const end = angle + slice;
        const x1 = cx + radius * Math.cos(angle);
        const y1 = cy + radius * Math.sin(angle);
        const x2 = cx + radius * Math.cos(end);
        const y2 = cy + radius * Math.sin(end);
        const large = slice > Math.PI ? 1 : 0;
        const fill = palette[index % palette.length];
        parts.push(
          `<path d="M ${round(cx)} ${round(cy)} L ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${large} 1 ${round(x2)} ${round(y2)} Z" fill="${escapeXml(fill)}" stroke="${escapeXml(specLock.colors.background)}" stroke-width="2"/>`,
        );
        angle = end;
      });
      if (chart.type === "doughnut") {
        const inner = radius * 0.56;
        parts.push(
          `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(inner)}" fill="${escapeXml(specLock.colors.background)}"/>`,
        );
      }
      const legendX = plotX + plotW * 0.66;
      const rowH = Math.max(16, Math.min(22, plotH / Math.max(data.length, 1)));
      const maxRows = Math.max(1, Math.floor(plotH / rowH));
      data.slice(0, maxRows).forEach((d, index) => {
        const y = plotY + 10 + index * rowH;
        const fill = palette[index % palette.length];
        parts.push(
          `<rect x="${round(legendX)}" y="${round(y - 9)}" width="10" height="10" rx="2" fill="${escapeXml(fill)}"/>`,
        );
        const maxChars = Math.max(
          3,
          Math.floor((plotX + plotW - legendX - 58) / (labelSize * 0.9)),
        );
        parts.push(
          textEl(legendX + 16, y, truncate(d.label, maxChars), {
            size: labelSize,
            fill: specLock.colors.text,
            font,
          }),
        );
        parts.push(
          textEl(plotX + plotW, y, formatValue(d.value), {
            size: valueSize,
            fill: specLock.colors.textMuted,
            font,
            anchor: "end",
          }),
        );
      });
    }
    return parts.join("");
  }

  const values = data.map((d) => d.value);
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const range = maxValue - minValue || 1;
  const zeroY = plotY + (maxValue / range) * plotH;
  const yOf = (value: number) => plotY + ((maxValue - value) / range) * plotH;

  parts.push(
    `<line x1="${round(plotX)}" y1="${round(zeroY)}" x2="${round(plotX + plotW)}" y2="${round(zeroY)}" stroke="${escapeXml(specLock.colors.textMuted)}" stroke-opacity="0.25" stroke-width="1"/>`,
  );

  if (chart.type === "line") {
    const step = data.length > 1 ? plotW / (data.length - 1) : 0;
    const points = data.map((d, index) => ({
      x: data.length > 1 ? plotX + step * index : plotX + plotW / 2,
      y: yOf(d.value),
      ...d,
    }));
    parts.push(
      `<polyline points="${points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${escapeXml(palette[0])}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
    );
    const maxChars = Math.max(
      3,
      Math.floor((data.length > 1 ? step : plotW) / (labelSize * 0.9)),
    );
    points.forEach((p) => {
      parts.push(
        `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="4" fill="${escapeXml(palette[0])}"/>`,
      );
      if (data.length <= 8) {
        parts.push(
          textEl(p.x, p.y - 8, formatValue(p.value), {
            size: valueSize,
            fill: specLock.colors.text,
            font,
            anchor: "middle",
          }),
        );
      }
      parts.push(
        textEl(p.x, plotBottom + 16, truncate(p.label, maxChars), {
          size: labelSize,
          fill: specLock.colors.textMuted,
          font,
          anchor: "middle",
        }),
      );
    });
    return parts.join("");
  }

  const slot = plotW / data.length;
  const barW = Math.max(6, Math.min(slot * 0.62, 76));
  const maxChars = Math.max(3, Math.floor((slot - 2) / (labelSize * 0.9)));
  data.forEach((d, index) => {
    const x = plotX + slot * index + (slot - barW) / 2;
    const y = yOf(d.value);
    const h = Math.abs(zeroY - y);
    const fill = palette[index % Math.min(palette.length, 3)];
    parts.push(
      `<rect x="${round(x)}" y="${round(Math.min(y, zeroY))}" width="${round(barW)}" height="${round(Math.max(h, 1))}" rx="2" fill="${escapeXml(fill)}"/>`,
    );
    parts.push(
      textEl(
        x + barW / 2,
        d.value >= 0 ? Math.min(y - 6, plotBottom - 4) : y + h + valueSize + 2,
        formatValue(d.value),
        {
          size: valueSize,
          fill: specLock.colors.text,
          font,
          anchor: "middle",
        },
      ),
    );
    parts.push(
      textEl(x + barW / 2, plotBottom + 16, truncate(d.label, maxChars), {
        size: labelSize,
        fill: specLock.colors.textMuted,
        font,
        anchor: "middle",
      }),
    );
  });
  return parts.join("");
}

function buildAttrs(original: string, chart: ChartSpec, box: Box): string {
  const attrs = parseAttrs(original);
  delete attrs.x;
  delete attrs.y;
  delete attrs.width;
  delete attrs.height;
  delete attrs.transform;
  delete attrs["data-chart-type"];
  delete attrs["data-chart-data"];
  delete attrs["data-chart-title"];

  const data = chart.data.map((d) => ({
    label: String(d.label ?? ""),
    value: Number.isFinite(Number(d.value)) ? Number(d.value) : 0,
  }));
  const merged: Record<string, string> = {
    ...attrs,
    x: String(box.x),
    y: String(box.y),
    width: String(box.w),
    height: String(box.h),
    "data-chart-type": chart.type,
    "data-chart-data": JSON.stringify(data),
  };
  if (chart.title?.trim()) {
    merged["data-chart-title"] = chart.title.trim();
  }
  return Object.entries(merged)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join("");
}

/**
 * 把 ChartTab 的结构化编辑确定性写回 SVG：
 * 更新 data-chart-* 并重绘组内图形，保持预览与原生 PPTX 图表一致。
 * 页面没有图表组时返回 synced=false，由调用方决定是否标记 svgStale。
 */
export function syncChartInSvg(
  svg: string,
  chart: ChartSpec,
  specLock: SpecLock,
): SyncChartResult {
  const group = findChartGroup(svg);
  if (!group) return { svg, synced: false };
  const box = resolveBox(group, specLock);
  const inner = renderChart(chart, box, specLock);
  const next =
    svg.slice(0, group.start) +
    `<g${buildAttrs(group.attrs, chart, box)}>${inner}</g>` +
    svg.slice(group.end);
  return { svg: next, synced: true };
}

export function removeChartFromSvg(svg: string): RemoveChartResult {
  const group = findChartGroup(svg);
  if (!group) return { svg, removed: false };
  return {
    svg: svg.slice(0, group.start) + svg.slice(group.end),
    removed: true,
  };
}

export function svgHasChartGroup(svg: string | undefined): boolean {
  return svg ? findChartGroup(svg) !== null : false;
}
