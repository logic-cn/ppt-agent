import type PptxGenJS from "pptxgenjs";
import type { SpecLock } from "@/design/spec-lock";

/*
 * 图表标记约定（供 SVG 生成端 svg-gen prompt 同步）：
 * SVG 内原生图表用 <g> 包裹并携带以下 data 属性：
 *   - data-chart-type: 图表类型，直接对应 pptxgenjs 的 CHART_NAME
 *       （bar | pie | line | doughnut | area | radar 等，移除 scatter/bubble
 *        因其需 [x,y] 数据与本约定的单 value 结构不兼容），非法值跳过。
 *   - data-chart-data: JSON 数组，每项形如 {"label":"A","value":10}，
 *       翻译为单一 series 的 labels / values。
 *   - 可选 x / y / width / height（SVG 像素）：定义图表在画布中的位置与尺寸；
 *       缺省时使用默认区域 x=100,y=100,w=1080,h=520（SVG 像素）。
 */

const VALID_CHART_TYPES: PptxGenJS.CHART_NAME[] = [
  "area",
  "bar",
  "bar3D",
  "doughnut",
  "line",
  "pie",
  "radar",
];

// 默认调色板：无 specLock 注入时使用的若干展示色（不含背景/文本类色）。
const DEFAULT_PALETTE = [
  "#2563EB",
  "#FACC15",
  "#22D3EE",
  "#8B5CF6",
  "#EA580C",
  "#10B981",
  "#EF4444",
  "#0EA5E9",
];

const SVG_W = 1280;
const SVG_H = 720;
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// 读取 SVG 像素属性，NaN/缺失时用 fallback（保留合法的 0 坐标）。
function numAttr(el: Element, name: string, fallback: number): number {
  const n = Number(el.getAttribute(name));
  return Number.isNaN(n) ? fallback : n;
}

interface ChartPoint {
  label: string;
  value: number;
}

export function translateChart(
  gEl: Element,
  pptxSlide: PptxGenJS.Slide,
  specLock?: SpecLock,
): void {
  const typeAttr = gEl.getAttribute("data-chart-type");
  const dataAttr = gEl.getAttribute("data-chart-data");
  if (!typeAttr || !dataAttr) return;

  const type = typeAttr as PptxGenJS.CHART_NAME;
  if (!VALID_CHART_TYPES.includes(type)) return;

  let points: ChartPoint[] = [];
  try {
    const parsed = JSON.parse(dataAttr);
    if (Array.isArray(parsed)) {
      points = parsed.map((d: { label?: unknown; value?: unknown }) => ({
        label: String(d.label ?? ""),
        value: Number(d.value ?? 0),
      }));
    }
  } catch {
    return;
  }
  if (points.length === 0) return;

  const x = numAttr(gEl, "x", 100);
  const y = numAttr(gEl, "y", 100);
  const w = numAttr(gEl, "width", 1080);
  const h = numAttr(gEl, "height", 520);

  const chartData = [
    {
      name: "数据",
      labels: points.map((p) => p.label),
      values: points.map((p) => p.value),
    },
  ];

  // 优先使用 specLock 设计契约配色（前几色作为图表系列色），无 specLock 时回退默认调色板。
  const chartColors =
    specLock && specLock.colors
      ? [
          specLock.colors.primary,
          specLock.colors.secondary,
          specLock.colors.accent,
          specLock.colors.text,
          specLock.colors.textMuted,
        ].filter(Boolean)
      : DEFAULT_PALETTE;

  const chartOpts = {
    x: (x / SVG_W) * SLIDE_W,
    y: (y / SVG_H) * SLIDE_H,
    w: (w / SVG_W) * SLIDE_W,
    h: (h / SVG_H) * SLIDE_H,
    showLegend: true,
    showTitle: false,
    chartColors,
  };

  pptxSlide.addChart(type, chartData, chartOpts);
}
