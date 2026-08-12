import type PptxGenJS from "pptxgenjs";
import {
  collectDefs,
  resolveFill,
  resolveGradientFill,
  sampleGradient,
  type ResolvedFill,
} from "./gradient";
import { translateChart } from "./chart";
import type { SpecLock } from "@/design/spec-lock";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const SVG_W = 1280;
const SVG_H = 720;
// SVG font-size 是 viewBox 像素：1280px ↔ 13.333in = 960pt，故 1px = 0.75pt
const PX_TO_PT = (SLIDE_W * 72) / SVG_W;
// SVG text 的 y 是基线；pptx 文本框以框顶定位。近似上伸比例，消除系统性垂直偏移
const BASELINE_ASCENT = 0.78;

export const CANVAS = { w: SLIDE_W, h: SLIDE_H };

function toX(x: number): number {
  return (x / SVG_W) * SLIDE_W;
}
function toY(y: number): number {
  return (y / SVG_H) * SLIDE_H;
}
function toW(w: number): number {
  return (w / SVG_W) * SLIDE_W;
}
function toH(h: number): number {
  return (h / SVG_H) * SLIDE_H;
}
function toPt(px: number): number {
  return px * PX_TO_PT;
}

function num(value: string | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

// ---- transform（P1-1）----

interface Transform {
  tx: number;
  ty: number;
  /** 仅取最近一次 rotate；cx/cy 缺省按 (0,0)（SVG 默认坐标原点） */
  rotate: { angle: number; cx: number; cy: number } | null;
}

/**
 * 沿自身 + 祖先 <g> 累计 transform。
 * 支持 translate(a[,b]) 与 rotate(a[,cx[,cy]])；
 * scale/matrix/skew 无法安全映射到 pptx 形状，记录为需扩展的旋转空角，按降级处理。
 * tx/ty 为累计平移；rotate 取元素链上最近一次（外围 translate 已并入 tx/ty）。
 */
function elementTransform(el: Element): Transform {
  let tx = 0;
  let ty = 0;
  let rotate: Transform["rotate"] = null;
  let cur: Element | null = el;
  while (cur) {
    const tag = cur.nodeName.toLowerCase();
    // 跳过 svg/defs/clippath：非渲染容器不参与累计
    if (tag === "svg" || tag === "defs" || tag === "clippath") break;
    const attr = cur.getAttribute("transform");
    if (attr) {
      const t = parseTransformAttr(attr);
      tx += t.tx;
      ty += t.ty;
      if (t.rotate) rotate = t.rotate;
    }
    cur = cur.parentElement;
  }
  return { tx, ty, rotate };
}

export function parseTransformAttr(attr: string): Transform {
  let tx = 0;
  let ty = 0;
  let rotate: Transform["rotate"] = null;
  const fnRe = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(attr))) {
    const name = m[1].toLowerCase();
    const args = (
      m[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
    ).map(Number);
    if (name === "translate") {
      tx += args[0] ?? 0;
      ty += args[1] ?? 0;
    } else if (name === "rotate") {
      rotate = { angle: args[0] ?? 0, cx: args[1] ?? 0, cy: args[2] ?? 0 };
    }
    // scale/matrix/skew 无法映射到 pptx，忽略（可继续累计 translate）
  }
  return { tx, ty, rotate };
}

// 旋转近似：围绕 (cx,cy) 旋转后取轴对齐包围盒（REVIEW P1-1 建议：rotate 上界扩充 rect）
export function rotateBBox(
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  cx: number,
  cy: number,
): { x: number; y: number; w: number; h: number } {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of corners) {
    const dx = px - cx;
    const dy = py - cy;
    const qx = cx + dx * cos - dy * sin;
    const qy = cy + dx * sin + dy * cos;
    if (qx < minX) minX = qx;
    if (qy < minY) minY = qy;
    if (qx > maxX) maxX = qx;
    if (qy > maxY) maxY = qy;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// 对 bbox 统一应用 transform：平移到 tx/ty；有 rotate 时按旋转上界扩充
function transposedBBox(
  el: Element,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const t = elementTransform(el);
  let bx = x + t.tx;
  let by = y + t.ty;
  if (t.rotate && t.rotate.angle) {
    const r = rotateBBox(
      bx,
      by,
      w,
      h,
      t.rotate.angle,
      t.rotate.cx,
      t.rotate.cy,
    );
    bx = r.x;
    by = r.y;
    w = r.w;
    h = r.h;
  }
  return { x: bx, y: by, w, h };
}

function hexColor(value: string | null | undefined): string {
  if (!value) return "000000";
  return value.replace(/^#/, "").trim() || "000000";
}

function textAnchorToAlign(
  anchor: string | null | undefined,
): "left" | "center" | "right" {
  if (anchor === "middle") return "center";
  if (anchor === "end") return "right";
  return "left";
}

// SVG opacity / fill-opacity → pptxgenjs transparency（0-100，100 为全透明）
function transparencyOf(el: Element | undefined): number | undefined {
  if (!el) return undefined;
  const raw = el.getAttribute("opacity") ?? el.getAttribute("fill-opacity");
  if (raw == null) return undefined;
  const o = Number.parseFloat(raw);
  if (!Number.isFinite(o) || o >= 1) return undefined;
  return Math.round((1 - Math.max(0, o)) * 100);
}

// transparency 属于 ShapeFillProps（fill 内），合并进 ResolvedFill
function fillWithTransparency(
  fill: ResolvedFill,
  el: Element | undefined,
): ResolvedFill {
  const transparency = transparencyOf(el);
  if (transparency == null) return fill;
  return { ...fill, transparency };
}

// 形状填充：显式 fill="none" 映射为无填充；
// 其余（含缺省）经 resolveFill 解析（缺省按 SVG 语义为黑）。
// 不得把 "none" 交给 resolveFill——非 hex 会被兜底成纯黑填充。
function shapeFill(
  el: Element,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): ResolvedFill | { type: "none" } {
  const raw = el.getAttribute("fill");
  if (raw === "none") return { type: "none" };
  return fillWithTransparency(resolveFill({ fill: raw }, defsById), el);
}

// SVG stroke → pptxgenjs line 选项；无描边时返回零宽线
function shapeLine(
  el: Element,
): { color: string; width: number } | { width: 0 } {
  const stroke = el.getAttribute("stroke");
  if (!stroke || stroke === "none") return { width: 0 };
  // 仅接受 hex 颜色；渐变引用 url(#g)、命名色等非 hex 值无法写入 PPTX，回退无描边
  if (!/^#?[0-9a-fA-F]{3,8}$/.test(stroke.trim())) return { width: 0 };
  return {
    color: hexColor(stroke),
    width: Math.max(toPt(num(el.getAttribute("stroke-width"), 1)), 0.25),
  };
}

function isBold(fontWeight: string | null): boolean {
  if (!fontWeight) return false;
  if (fontWeight === "bold" || fontWeight === "bolder") return true;
  const n = Number.parseFloat(fontWeight);
  return Number.isFinite(n) && n >= 600;
}

export function translateSvgToSlide(
  svg: string,
  pptxSlide: PptxGenJS.Slide,
  specLock?: SpecLock,
  notes?: string,
): void {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return;

  const defsById = collectDefs(svg);

  // 混合内容流模型：为每个含直接文本的 text/tspan 预计算渲染起点补偿
  // （start，相对自身 origin.x）与流终点补偿（end，供其后缀文本定位）
  const place = buildTspanFlow(doc);

  const elements = root.querySelectorAll(
    "rect, circle, ellipse, line, text, tspan, path, g, polygon, polyline, image",
  );
  elements.forEach((el) => {
    const tag = el.nodeName.toLowerCase();
    // 含 data-chart-type 的 group 视为原生图表标记，走图表翻译，
    // 不再按普通 group 处理其 children，避免重复绘制。
    if (tag === "g") {
      if (el.getAttribute("data-chart-type")) {
        translateChart(el, pptxSlide, specLock);
      }
      return;
    }
    switch (tag) {
      case "rect":
        translateRect(el, pptxSlide, defsById);
        break;
      case "circle":
      case "ellipse":
        translateEllipse(el, tag, pptxSlide, defsById);
        break;
      case "line":
        translateLine(el, pptxSlide);
        break;
      case "text": {
        // 含 tspan 时拆分自身直接文本：前缀按自身位置渲染，后缀跟随流终点；
        // 由各 tspan 分支渲染各自内容，避免同一段文本被渲染两次。
        if (el.querySelector("tspan")) {
          const { prefix, suffix } = splitDirectText(el);
          const p = place.get(el);
          if (prefix)
            translateTextLike(el, pptxSlide, defsById, prefix, p?.start ?? 0);
          if (suffix)
            translateTextLike(el, pptxSlide, defsById, suffix, p?.suffix ?? 0);
          break;
        }
        translateTextLike(el, pptxSlide, defsById);
        break;
      }
      case "tspan": {
        const p = place.get(el);
        const start = p?.start ?? 0;
        // 含嵌套 tspan 时拆分外层直接文本：前缀按自身位置、后缀跟随其流终点；
        // 内层 tspan 由各自分支渲染，避免同一段文本被渲染两次。
        if (el.querySelector("tspan")) {
          const { prefix, suffix } = splitDirectText(el);
          if (prefix) translateTextLike(el, pptxSlide, defsById, prefix, start);
          if (suffix)
            translateTextLike(
              el,
              pptxSlide,
              defsById,
              suffix,
              p?.suffix ?? start,
            );
          break;
        }
        translateTextLike(el, pptxSlide, defsById, undefined, start);
        break;
      }
      case "path":
        translatePath(el, pptxSlide, defsById);
        break;
      case "polygon":
        translatePolygon(el, pptxSlide, defsById);
        break;
      case "polyline":
        translatePolyline(el, pptxSlide);
        break;
      case "image":
        translateImage(el, pptxSlide);
        break;
    }
  });

  if (notes && notes.trim()) {
    pptxSlide.addNotes(notes);
  }
}

function translateRect(
  el: Element,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): void {
  const rx = el.getAttribute("rx");
  // P1-1：transform 平移 + rotate 近似（外形不变，位置/尺寸映射）
  const b = transposedBBox(
    el,
    num(el.getAttribute("x")),
    num(el.getAttribute("y")),
    num(el.getAttribute("width")),
    num(el.getAttribute("height")),
  );
  // P1-3：线性渐变矩形按 stop 纵向分段近似；其余走单色兜底
  const gf = resolveGradientFill({ fill: el.getAttribute("fill") }, defsById);
  const line = shapeLine(el);
  if (gf.gradient && gf.gradient.type === "linear" && (!rx || num(rx) <= 0)) {
    drawGradientSlices(slide, gf.gradient, b, line);
    return;
  }
  const fill = shapeFill(el, defsById);
  if (rx != null && num(rx) > 0) {
    slide.addShape("roundRect", {
      x: toX(b.x),
      y: toY(b.y),
      w: toW(b.w),
      h: toH(b.h),
      fill,
      rectRadius: toW(num(rx)),
      line,
    });
  } else {
    slide.addShape("rect", {
      x: toX(b.x),
      y: toY(b.y),
      w: toW(b.w),
      h: toH(b.h),
      fill,
      line,
    });
  }
}

/**
 * P1-3：线性渐变降级为纵向色块（每 stop 一段，用 stop 色填充），
 * 描边（如有）以无填充线框叠加在色块之上，保证外形与描边不丢。
 */
function drawGradientSlices(
  slide: PptxGenJS.Slide,
  gradient: { stops: { offset: number; color: string }[] },
  b: { x: number; y: number; w: number; h: number },
  line: ReturnType<typeof shapeLine>,
): void {
  // 等分 n 段，每段用其中点处的插值色（视觉接近连续渐变）
  const n = Math.max(2, gradient.stops.length);
  const sliceH = b.h / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    slide.addShape("rect", {
      x: toX(b.x),
      y: toY(b.y + i * sliceH),
      w: toW(b.w),
      h: toH(sliceH),
      fill: { color: sampleGradient(gradient.stops, t) },
      line: { width: 0 },
    });
  }
  // 描边覆盖：色块之上再画一个无填充线框
  if ("width" in line && line.width > 0) {
    slide.addShape("rect", {
      x: toX(b.x),
      y: toY(b.y),
      w: toW(b.w),
      h: toH(b.h),
      fill: { type: "none" },
      line,
    });
  }
}

function translateEllipse(
  el: Element,
  tag: string,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): void {
  const fill = shapeFill(el, defsById);
  const line = shapeLine(el);
  if (tag === "circle") {
    const cx = num(el.getAttribute("cx"));
    const cy = num(el.getAttribute("cy"));
    const r = num(el.getAttribute("r"));
    const b = transposedBBox(el, cx - r, cy - r, r * 2, r * 2);
    slide.addShape("ellipse", {
      x: toX(b.x),
      y: toY(b.y),
      w: toW(b.w),
      h: toH(b.h),
      fill,
      line,
    });
  } else {
    const cx = num(el.getAttribute("cx"));
    const cy = num(el.getAttribute("cy"));
    const rx = num(el.getAttribute("rx"));
    const ry = num(el.getAttribute("ry"));
    const b = transposedBBox(el, cx - rx, cy - ry, rx * 2, ry * 2);
    slide.addShape("ellipse", {
      x: toX(b.x),
      y: toY(b.y),
      w: toW(b.w),
      h: toH(b.h),
      fill,
      line,
    });
  }
}

function translateLine(el: Element, slide: PptxGenJS.Slide): void {
  const x1 = num(el.getAttribute("x1"));
  const y1 = num(el.getAttribute("y1"));
  const x2 = num(el.getAttribute("x2"));
  const y2 = num(el.getAttribute("y2"));
  const color = hexColor(el.getAttribute("stroke") ?? el.getAttribute("fill"));
  const width = Math.max(toPt(num(el.getAttribute("stroke-width"), 1)), 0.25);
  const t = elementTransform(el);
  const b =
    t.rotate && t.rotate.angle
      ? rotateBBox(
          Math.min(x1, x2) + t.tx,
          Math.min(y1, y2) + t.ty,
          Math.abs(x2 - x1),
          Math.abs(y2 - y1),
          t.rotate.angle,
          t.rotate.cx,
          t.rotate.cy,
        )
      : {
          x: Math.min(x1, x2) + t.tx,
          y: Math.min(y1, y2) + t.ty,
          w: Math.abs(x2 - x1),
          h: Math.abs(y2 - y1),
        };
  slide.addShape("line", {
    x: toX(b.x),
    y: toY(b.y),
    w: toW(Math.max(b.w, 0.01)),
    h: toH(Math.max(b.h, 0.01)),
    line: { color, width },
  });
}

// 纯字形宽度（viewBox 像素）：CJK 全角按字号，其余按 0.55 倍字号近似
function glyphWidthPx(text: string, fontSizePx: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55;
  }
  return w;
}

// 估算文本框宽度（viewBox 像素）：字形宽 + 0.4em 尾距（防贴边裁切），最小一字符
function estimateTextWidthPx(text: string, fontSizePx: number): number {
  return Math.max(
    glyphWidthPx(text, fontSizePx) + fontSizePx * 0.4,
    fontSizePx,
  );
}

// 解析 font-size：仅接受裸数字或 px 单位，em/% 等其他单位按规范无法换算，回退默认
function fontSizePxOf(el: Element): number {
  const raw = attrFromChain(el, "font-size");
  if (raw == null) return 18;
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(px)?$/i);
  if (!m) return 18;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 18;
}

// text / tspan 属性链：自身 + 沿 tspan/text 祖先（嵌套 tspan 也能继承），到 <text> 为止
function textChain(el: Element): Element[] {
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur) {
    const tag = cur.nodeName.toLowerCase();
    if (tag !== "text" && tag !== "tspan") break;
    chain.push(cur);
    if (tag === "text") break;
    cur = cur.parentElement;
  }
  return chain;
}

function attrFromChain(el: Element, name: string): string | null {
  for (const node of textChain(el)) {
    const v = node.getAttribute(name);
    if (v != null) return v;
  }
  return null;
}

// 透明度沿链查找：opacity / fill-opacity 显式出现（含 1）即终止，不再继承上层
function transparencyFromChain(el: Element): number | undefined {
  for (const node of textChain(el)) {
    if (node.hasAttribute("opacity")) return transparencyOf(node);
    if (node.hasAttribute("fill-opacity")) return transparencyOf(node);
  }
  return undefined;
}

// tspan 绝对位置：dx/dy 累计到两轴各自最近的显式 x/y 基准为止（含基准自身的 dx/dy）；
// 基准之上的 dx/dy 只作用于其自身文本起点，不影响带绝对坐标的后代。
// 注：dx/dy 多值列表（如 "10,20,30" 逐字符偏移）仅取首值作整体平移，属务实近似。
function resolveTextOrigin(el: Element): { x: number; y: number } {
  let dx = 0;
  let dy = 0;
  let baseX: number | null = null;
  let baseY: number | null = null;
  for (const node of textChain(el)) {
    if (baseX == null) {
      dx += num(node.getAttribute("dx"));
      if (node.getAttribute("x") != null) baseX = num(node.getAttribute("x"));
    }
    if (baseY == null) {
      dy += num(node.getAttribute("dy"));
      if (node.getAttribute("y") != null) baseY = num(node.getAttribute("y"));
    }
    if (baseX != null && baseY != null) break;
  }
  return { x: (baseX ?? 0) + dx, y: (baseY ?? 0) + dy };
}

// 拆分 text 的直接文本为前缀/后缀：第一个 tspan 之前的为前缀，之后的为后缀。
// 注：tspan 之间的中段文本并入后缀（跟随后续 tspan 流终点），属务实近似。
function splitDirectText(el: Element): { prefix: string; suffix: string } {
  let prefix = "";
  let suffix = "";
  let inSuffix = false;
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const seg = node.textContent ?? "";
      if (inSuffix) suffix += seg;
      else prefix += seg;
    } else if (node.nodeName.toLowerCase() === "tspan") {
      inSuffix = true;
    }
  }
  return { prefix, suffix };
}

// 连续空白折叠为单空格（与 SVG 默认 white-space 渲染一致）
function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// xml:space="preserve" 时保留原样空白（沿链查找，text 与 tspan 均可设置）
function hasPreserveSpace(el: Element): boolean {
  for (const node of textChain(el)) {
    const v = node.getAttribute("xml:space");
    if (v === "preserve") return true;
    if (v === "default") return false;
  }
  return false;
}

// 混合内容流模型：按文档序模拟 SVG 文本流（含嵌套 tspan），输出各节点的
// 渲染起点补偿（start）与后缀文本起点补偿（suffix），均相对该节点自身 origin.x：
// - 流位置为绝对坐标：text 渲染起点 = x + dx，前缀占位后依次排布各 tspan
// - 相邻块推进量 = 前一块纯字形宽（与 anchor 无关）：首块锚定在 textX，
//   其后每块锚点前进一个字形宽，字形才能首尾相接不重叠（用含 0.4em 尾距的
//   框宽推进会错位：middle 下相邻字形重叠、left 下留缝）
// - 显式 x 的 tspan：起点为绝对 x + 自身 dx；其后兄弟跟随其右缘
// - 无定位 tspan：起点为当前流位置 + 自身 dx；补偿 = 流位置 - origin.x，
//   resolveTextOrigin 中的祖先 dx 累计在此差中自动抵消
// - 含嵌套的 tspan：前缀占位 → 内层排布 → 后缀（suffix 起点 = 内层流终点）
// 文本宽度仅按直接文本估算（preserve 不折叠、空文本不占位），内层由递归推进。
// 返回：place（text/tspan → { start, suffix }）。
function buildTspanFlow(
  doc: Document,
): Map<Element, { start: number; suffix: number }> {
  const place = new Map<Element, { start: number; suffix: number }>();
  for (const text of doc.querySelectorAll("text")) {
    const textX = num(text.getAttribute("x"));
    const { prefix } = splitDirectText(text);
    const prefixW = advanceTextWidth(text, prefix);
    // 绝对流位置：text 渲染起点（x + dx）+ 前缀占位推进
    let flow = textX + num(text.getAttribute("dx")) + prefixW;
    const originX = resolveTextOrigin(text).x;
    const walk = (node: Element, flowStart: number): number => {
      for (const child of [...node.children]) {
        if (child.nodeName.toLowerCase() !== "tspan") continue;
        const { prefix: childPrefix, suffix: childSuffix } =
          splitDirectText(child);
        const prefixW = advanceTextWidth(child, childPrefix);
        const suffixW = advanceTextWidth(child, childSuffix);
        const hasX = child.getAttribute("x") != null;
        const dx = num(child.getAttribute("dx"));
        const childOrigin = resolveTextOrigin(child).x;
        const svgPos = hasX
          ? num(child.getAttribute("x")) + dx
          : flowStart + dx;
        // 前缀占位 → 内层 tspan 排布 → 后缀
        let next = svgPos + prefixW;
        next = walk(child, next);
        place.set(child, {
          start: svgPos - childOrigin,
          suffix: next - childOrigin,
        });
        flowStart = next + suffixW;
      }
      return flowStart;
    };
    flow = walk(text, flow);
    place.set(text, { start: 0, suffix: flow - originX });
  }
  return place;
}

// 流推进宽度：仅纯字形宽（不含尾距/下限），与文本框宽 estimateTextWidthPx 区分。
// preserve 不折叠；空文本不占位
function advanceTextWidth(el: Element, rawText: string): number {
  const text = hasPreserveSpace(el) ? rawText.trim() : collapseSpace(rawText);
  return text ? glyphWidthPx(text, fontSizePxOf(el)) : 0;
}

// text / tspan 共用翻译：缺失属性沿 <text> 祖先链继承。
// 显式给出文本框 w/h，避免 pptxgenjs 默认换行与浏览器排版不一致。
// textOnly：渲染指定文本而非 textContent（text 混合内容时只取直接文本）；
// extraDxPx：x 方向额外偏移（tspan 前缀补偿）。
function translateTextLike(
  el: Element,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
  textOnly?: string,
  extraDxPx = 0,
): void {
  const raw = textOnly ?? el.textContent ?? "";
  const text = hasPreserveSpace(el) ? raw.trim() : collapseSpace(raw);
  if (!text) return;
  const attr = (name: string): string | null => attrFromChain(el, name);

  const fontSizePx = fontSizePxOf(el);
  const anchor = textAnchorToAlign(attr("text-anchor"));
  const wPx = estimateTextWidthPx(text, fontSizePx);
  const hPx = fontSizePx * 1.4;

  // SVG x/y 是锚点基线：按 anchor 反推文本框左上角，并把基线换算为框顶
  const origin = resolveTextOrigin(el);
  let xBox = origin.x + extraDxPx;
  if (anchor === "center") xBox -= wPx / 2;
  else if (anchor === "right") xBox -= wPx;
  let yBox = origin.y - fontSizePx * BASELINE_ASCENT;
  // P1-1：祖先 translate 平移文本；rotate 对文本不做 bbox 扩充（wrap:false 单行近似）
  const t = elementTransform(el);
  xBox += t.tx;
  yBox += t.ty;

  const fill = resolveFill({ fill: attr("fill") ?? undefined }, defsById);
  slide.addText(text, {
    x: toX(xBox),
    y: toY(yBox),
    w: toW(wPx),
    h: toH(hPx),
    fontSize: toPt(fontSizePx),
    color: fill.color,
    transparency: transparencyFromChain(el),
    fontFace: attr("font-family") ?? "Arial",
    bold: isBold(attr("font-weight")),
    align: anchor,
    valign: "top",
    wrap: false,
  });
}

// ---- path 识别（P1-2）：常见路径映射到 pptx 原生 shape ----

interface PathArc {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  large: boolean;
  sweep: boolean;
}

export type ClassifiedPath =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | {
      kind: "roundedRect";
      x: number;
      y: number;
      w: number;
      h: number;
      r: number;
    }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | {
      kind: "unknown";
      bbox: { x: number; y: number; w: number; h: number } | null;
    };

// 解析 path d 为绝对坐标段（用于分类），忽略曲线控制点，仅关注端点/弧段
function parsePathSegments(d: string): {
  moves: { x: number; y: number }[];
  arcs: Omit<PathArc, "startX" | "startY">[];
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  closes: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
} {
  let cx = 0;
  let cy = 0;
  const moves: { x: number; y: number }[] = [];
  const arcs: Omit<PathArc, "startX" | "startY">[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let closes = 0;
  const xs: number[] = [];
  const ys: number[] = [];
  const segs = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) ?? [];
  const stepMap: Record<string, number> = { C: 6, S: 4, Q: 4, A: 7 };
  for (const seg of segs) {
    const letter = seg[0];
    const upper = letter.toUpperCase();
    const rel = letter !== upper;
    const n = (
      seg.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
    ).map(Number);
    const abs = (v: number, base: number, isRel: boolean) =>
      isRel ? base + v : v;
    if (upper === "Z") {
      closes += 1;
      continue;
    }
    if (upper === "M" || upper === "L" || upper === "T") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        const isRel = rel && !(upper === "M" && i === 0);
        const nx = abs(n[i], cx, isRel);
        const ny = abs(n[i + 1], cy, isRel);
        const priorX = cx;
        const priorY = cy;
        cx = nx;
        cy = ny;
        xs.push(cx);
        ys.push(cy);
        if (upper === "M") moves.push({ x: cx, y: cy });
        else lines.push({ x1: priorX, y1: priorY, x2: cx, y2: cy });
      }
      continue;
    }
    if (upper === "H") {
      for (const v of n) {
        cx = abs(v, cx, rel);
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    if (upper === "V") {
      for (const v of n) {
        cy = abs(v, cy, rel);
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    if (upper === "A") {
      for (let i = 0; i + 7 <= n.length; i += 7) {
        const rawRx = n[i];
        const rawRy = n[i + 1];
        const rot = n[i + 2];
        const large = n[i + 3] !== 0;
        const sweep = n[i + 4] !== 0;
        const endX = abs(n[i + 5], cx, rel);
        const endY = abs(n[i + 6], cy, rel);
        // 仅支持无旋转椭圆弧的中心求解；旋转弧回退（点集仍累计）
        if (rot === 0 && rawRx > 0 && rawRy > 0) {
          const center = arcCenter(
            cx,
            cy,
            endX,
            endY,
            rawRx,
            rawRy,
            large,
            sweep,
          );
          if (center) {
            arcs.push({
              cx: center.cx,
              cy: center.cy,
              rx: rawRx,
              ry: rawRy,
              endX,
              endY,
              large,
              sweep,
            });
            xs.push(center.cx + rawRx, center.cx - rawRx);
            ys.push(center.cy + rawRy, center.cy - rawRy);
            xs.push(endX, cx);
            ys.push(endY, cy);
          }
        }
        cx = endX;
        cy = endY;
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    const step = stepMap[upper];
    if (step) {
      // 忽略 C/S/Q 曲线控制点，仅推进端点
      for (let i = 0; i + step <= n.length; i += step) {
        cx = abs(n[i + step - 2], cx, rel);
        cy = abs(n[i + step - 1], cy, rel);
        xs.push(cx);
        ys.push(cy);
      }
    }
  }
  return {
    moves,
    arcs,
    lines,
    closes,
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function arcCenter(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  large: boolean,
  sweep: boolean,
): { cx: number; cy: number } | null {
  // SVG 椭圆弧中心（F.6.5，rotation=0）
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
  const denom = rx * rx * dy * dy + ry * ry * dx * dx;
  if (denom === 0 || num < 0) return null;
  const coef = Math.sqrt(Math.max(num, 0) / denom);
  const sign = large === sweep ? -1 : 1;
  const cxp = (sign * coef * (rx * dy)) / ry;
  const cyp = ((sign * coef * (ry * dx)) / rx) * -1;
  return { cx: (x1 + x2) / 2 + cxp, cy: (y1 + y2) / 2 + cyp };
}

export function classifyPath(d: string): ClassifiedPath {
  const info = parsePathSegments(d);
  // 无有效坐标（空点集/退化）→ unknown，由调用方跳过，避免 Infinity/NaN 落盘
  if (
    !Number.isFinite(info.minX) ||
    info.maxX - info.minX <= 0 ||
    info.maxY - info.minY <= 0
  ) {
    return { kind: "unknown", bbox: null };
  }
  // 1) 纯弧路径 → 圆/椭圆（≥2 段弧才能覆盖全周长；单段弧至多 180°，不得判为整圆）
  if (info.arcs.length >= 2) {
    const r0 = info.arcs[0];
    const rx = r0.rx;
    const ry = r0.ry;
    const allSame = info.arcs.every(
      (a) =>
        Math.abs(a.rx - rx) < 0.01 &&
        Math.abs(a.ry - ry) < 0.01 &&
        Math.abs(a.cx - r0.cx) < 0.05 &&
        Math.abs(a.cy - r0.cy) < 0.05,
    );
    if (allSame) {
      if (Math.abs(rx - ry) < 0.01) {
        return {
          kind: "circle",
          cx: r0.cx,
          cy: r0.cy,
          r: (rx + ry) / 2,
        };
      }
      return { kind: "ellipse", cx: r0.cx, cy: r0.cy, rx, ry };
    }
  }
  // 2) 圆角矩形：闭环且恰 4 个 90° 圆弧，边框与之匹配
  if (info.arcs.length === 4 && info.lines.length >= 0) {
    const r0 = info.arcs[0];
    // 四个弧共圆角半径（rx≈ry）
    const arcMatch = info.arcs.every(
      (a) => Math.abs(a.rx - a.ry) < 0.001 && Math.abs(a.rx - r0.rx) < 0.05,
    );
    if (arcMatch) {
      const w = info.maxX - info.minX;
      const h = info.maxY - info.minY;
      if (w > 0 && h > 0 && r0.rx > 0 && r0.rx * 2 < Math.min(w, h)) {
        return {
          kind: "roundedRect",
          x: info.minX,
          y: info.minY,
          w,
          h,
          r: r0.rx,
        };
      }
    }
  }
  // 3) 直线路径（M 后单 L，无填充时）→ line
  if (info.arcs.length === 0 && info.lines.length === 1 && !info.closes) {
    const l = info.lines[0];
    return { kind: "line", x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 };
  }
  // 4) 其余：保留包围盒
  const w = info.maxX - info.minX;
  const h = info.maxY - info.minY;
  return { kind: "rect", x: info.minX, y: info.minY, w, h };
}

// 解析 path d 的近似包围盒（控制点一并计入，略微放大，安全侧）。
// pptxgenjs 无 custGeom API，拟合失败的路径降级为包围盒矩形。
export function parsePathBBox(
  d: string,
): { x: number; y: number; w: number; h: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  let cx = 0;
  let cy = 0;
  const segs = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) ?? [];
  const stepMap: Record<string, number> = { C: 6, S: 4, Q: 4 };
  for (const seg of segs) {
    const letter = seg[0];
    const upper = letter.toUpperCase();
    const rel = letter !== upper;
    const n = (
      seg.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
    ).map(Number);
    const abs = (v: number, base: number, isRel: boolean) =>
      isRel ? base + v : v;

    if (upper === "Z") continue;
    if (upper === "M" || upper === "L" || upper === "T") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        // 相对 m 的第一组坐标按 SVG 规范视为绝对
        const isRel = rel && !(upper === "M" && i === 0);
        cx = abs(n[i], cx, isRel);
        cy = abs(n[i + 1], cy, isRel);
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    if (upper === "H") {
      for (const v of n) {
        cx = abs(v, cx, rel);
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    if (upper === "V") {
      for (const v of n) {
        cy = abs(v, cy, rel);
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    if (upper === "A") {
      // arc 参数 rx ry x-rot large-arc sweep x y；仅终点 (x,y) 参与包围盒，
      // rx/ry 恒为绝对、x-rot 与标志位均非坐标，不得混入
      for (let i = 0; i + 7 <= n.length; i += 7) {
        cx = abs(n[i + 5], cx, rel);
        cy = abs(n[i + 6], cy, rel);
        xs.push(cx);
        ys.push(cy);
      }
      continue;
    }
    const step = stepMap[upper];
    if (step) {
      for (let i = 0; i + step <= n.length; i += step) {
        for (let k = 0; k < step - 2; k += 2) {
          xs.push(abs(n[i + k], cx, rel));
          ys.push(abs(n[i + k + 1], cy, rel));
        }
        cx = abs(n[i + step - 2], cx, rel);
        cy = abs(n[i + step - 1], cy, rel);
        xs.push(cx);
        ys.push(cy);
      }
    }
  }
  if (xs.length === 0) return null;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    w: Math.max(...xs) - minX,
    h: Math.max(...ys) - minY,
  };
}

function translatePath(
  el: Element,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): void {
  const fillAttr = el.getAttribute("fill");
  const stroke = el.getAttribute("stroke");
  const hasFill = !!fillAttr && fillAttr !== "none";
  const d = el.getAttribute("d");
  if (!d) return;

  const cls = classifyPath(d);
  if (cls.kind === "unknown") {
    if (!hasFill && (!stroke || stroke === "none")) return;
    const bbox = parsePathBBox(d);
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) return;
    const b = transposedBBox(el, bbox.x, bbox.y, bbox.w, bbox.h);
    slide.addShape("rect", {
      x: toX(b.x),
      y: toY(b.y),
      w: toW(b.w),
      h: toH(b.h),
      fill: hasFill
        ? fillWithTransparency(resolveFill({ fill: fillAttr }, defsById), el)
        : { type: "none" },
      line: shapeLine(el),
    });
    return;
  }

  // 显式 fill="none"（或仅描边）时不得填充：resolveFill 会把非 hex 值解析成黑
  const fill: ResolvedFill | { type: "none" } = hasFill
    ? fillWithTransparency(resolveFill({ fill: fillAttr }, defsById), el)
    : { type: "none" };
  const line = shapeLine(el);

  switch (cls.kind) {
    case "circle": {
      const b = transposedBBox(
        el,
        cls.cx - cls.r,
        cls.cy - cls.r,
        cls.r * 2,
        cls.r * 2,
      );
      slide.addShape("ellipse", {
        x: toX(b.x),
        y: toY(b.y),
        w: toW(b.w),
        h: toH(b.h),
        fill,
        line,
      });
      return;
    }
    case "ellipse": {
      const b = transposedBBox(
        el,
        cls.cx - cls.rx,
        cls.cy - cls.ry,
        cls.rx * 2,
        cls.ry * 2,
      );
      slide.addShape("ellipse", {
        x: toX(b.x),
        y: toY(b.y),
        w: toW(b.w),
        h: toH(b.h),
        fill,
        line,
      });
      return;
    }
    case "roundedRect": {
      const b = transposedBBox(el, cls.x, cls.y, cls.w, cls.h);
      slide.addShape("roundRect", {
        x: toX(b.x),
        y: toY(b.y),
        w: toW(b.w),
        h: toH(b.h),
        rectRadius: toW(cls.r),
        fill,
        line,
      });
      return;
    }
    case "rect": {
      // 兼容生成约定：显式 width/height 属性优先（老路径省略 d 细节时）
      const rawW = num(el.getAttribute("width"));
      const rawH = num(el.getAttribute("height"));
      const bx = rawW > 0 && rawH > 0 ? num(el.getAttribute("x")) : cls.x;
      const by = rawW > 0 && rawH > 0 ? num(el.getAttribute("y")) : cls.y;
      const bw = rawW > 0 && rawH > 0 ? rawW : cls.w;
      const bh = rawW > 0 && rawH > 0 ? rawH : cls.h;
      const b = transposedBBox(el, bx, by, bw, bh);
      slide.addShape("rect", {
        x: toX(b.x),
        y: toY(b.y),
        w: toW(b.w),
        h: toH(b.h),
        fill,
        line,
      });
      return;
    }
    case "line": {
      if (!stroke || stroke === "none") return;
      const t = elementTransform(el);
      const b =
        t.rotate && t.rotate.angle
          ? rotateBBox(
              Math.min(cls.x1, cls.x2) + t.tx,
              Math.min(cls.y1, cls.y2) + t.ty,
              Math.abs(cls.x2 - cls.x1),
              Math.abs(cls.y2 - cls.y1),
              t.rotate.angle,
              t.rotate.cx,
              t.rotate.cy,
            )
          : {
              x: Math.min(cls.x1, cls.x2) + t.tx,
              y: Math.min(cls.y1, cls.y2) + t.ty,
              w: Math.abs(cls.x2 - cls.x1),
              h: Math.abs(cls.y2 - cls.y1),
            };
      slide.addShape("line", {
        x: toX(b.x),
        y: toY(b.y),
        w: toW(Math.max(b.w, 0.01)),
        h: toH(Math.max(b.h, 0.01)),
        line: {
          color: hexColor(stroke),
          width: Math.max(toPt(num(el.getAttribute("stroke-width"), 1)), 0.25),
        },
      });
      return;
    }
  }
}

function parsePointsAttr(raw: string | null): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  if (!raw) return { xs, ys };
  const n = raw.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  for (let i = 0; i + 1 < n.length; i += 2) {
    xs.push(Number(n[i]));
    ys.push(Number(n[i + 1]));
  }
  return { xs, ys };
}

function translatePolygon(
  el: Element,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): void {
  const { xs, ys } = parsePointsAttr(el.getAttribute("points"));
  if (xs.length < 3) return;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  if (w <= 0 || h <= 0) return;
  // SVG polygon 默认 fill 为黑；降级为包围盒矩形
  const fill = shapeFill(el, defsById);
  const b = transposedBBox(el, minX, minY, w, h);
  slide.addShape("rect", {
    x: toX(b.x),
    y: toY(b.y),
    w: toW(b.w),
    h: toH(b.h),
    fill,
    line: shapeLine(el),
  });
}

function translatePolyline(el: Element, slide: PptxGenJS.Slide): void {
  const { xs, ys } = parsePointsAttr(el.getAttribute("points"));
  if (xs.length < 2) return;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const color = hexColor(el.getAttribute("stroke") ?? "#000000");
  const b = transposedBBox(el, minX, minY, w, h);
  slide.addShape("line", {
    x: toX(b.x),
    y: toY(b.y),
    w: toW(Math.max(b.w, 0.01)),
    h: toH(Math.max(b.h, 0.01)),
    line: {
      color,
      width: Math.max(toPt(num(el.getAttribute("stroke-width"), 1)), 0.25),
    },
  });
}

function translateImage(el: Element, slide: PptxGenJS.Slide): void {
  const href =
    el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? undefined;
  // 契约只允许 data: 内嵌图；外部 URL 跳过（导出端不做网络抓取）
  if (!href || !href.startsWith("data:")) return;
  const w = num(el.getAttribute("width"));
  const h = num(el.getAttribute("height"));
  if (w <= 0 || h <= 0) return;
  const b = transposedBBox(
    el,
    num(el.getAttribute("x")),
    num(el.getAttribute("y")),
    w,
    h,
  );
  slide.addImage({
    data: href.replace(/^data:/, ""),
    x: toX(b.x),
    y: toY(b.y),
    w: toW(b.w),
    h: toH(b.h),
  });
}
