import type PptxGenJS from "pptxgenjs";
import { collectDefs, resolveFill, type ResolvedFill } from "./gradient";
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
      case "text":
        // 若 text 含 tspan 子元素，则其直接文本已由各 tspan 分支渲染，
        // 此处仅处理不含 tspan 的纯文本，避免同一段文本被渲染两次。
        if (el.querySelector("tspan")) break;
        translateTextLike(el, pptxSlide, defsById);
        break;
      case "tspan":
        // 含嵌套 tspan 时其直接文本已由内层 tspan 渲染，避免同一文本渲染两次
        if (el.querySelector("tspan")) break;
        translateTextLike(el, pptxSlide, defsById);
        break;
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
  const x = toX(num(el.getAttribute("x")));
  const y = toY(num(el.getAttribute("y")));
  const w = toW(num(el.getAttribute("width")));
  const h = toH(num(el.getAttribute("height")));
  const rx = el.getAttribute("rx");
  const fill = fillWithTransparency(
    resolveFill({ fill: el.getAttribute("fill") }, defsById),
    el,
  );
  const line = shapeLine(el);
  if (rx != null && num(rx) > 0) {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      fill,
      rectRadius: toW(num(rx)),
      line,
    });
  } else {
    slide.addShape("rect", { x, y, w, h, fill, line });
  }
}

function translateEllipse(
  el: Element,
  tag: string,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): void {
  const fill = fillWithTransparency(
    resolveFill({ fill: el.getAttribute("fill") }, defsById),
    el,
  );
  const line = shapeLine(el);
  if (tag === "circle") {
    const cx = num(el.getAttribute("cx"));
    const cy = num(el.getAttribute("cy"));
    const r = num(el.getAttribute("r"));
    slide.addShape("ellipse", {
      x: toX(cx - r),
      y: toY(cy - r),
      w: toW(r * 2),
      h: toH(r * 2),
      fill,
      line,
    });
  } else {
    const cx = num(el.getAttribute("cx"));
    const cy = num(el.getAttribute("cy"));
    const rx = num(el.getAttribute("rx"));
    const ry = num(el.getAttribute("ry"));
    slide.addShape("ellipse", {
      x: toX(cx - rx),
      y: toY(cy - ry),
      w: toW(rx * 2),
      h: toH(ry * 2),
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
  slide.addShape("line", {
    x: toX(Math.min(x1, x2)),
    y: toY(Math.min(y1, y2)),
    w: toW(Math.max(Math.abs(x2 - x1), 0.01)),
    h: toH(Math.max(Math.abs(y2 - y1), 0.01)),
    line: { color, width },
  });
}

// 估算文本宽度（viewBox 像素）：CJK 全角按字号，其余按 0.55 倍字号近似
function estimateTextWidthPx(text: string, fontSizePx: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55;
  }
  return Math.max(w + fontSizePx * 0.4, fontSizePx);
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

// text / tspan 共用翻译：缺失属性沿 <text> 祖先链继承。
// 显式给出文本框 w/h，避免 pptxgenjs 默认换行与浏览器排版不一致。
function translateTextLike(
  el: Element,
  slide: PptxGenJS.Slide,
  defsById: Record<string, ReturnType<typeof collectDefs>[string]>,
): void {
  const text = el.textContent ?? "";
  if (!text.trim()) return;
  const attr = (name: string): string | null => attrFromChain(el, name);

  const fontSizePx = fontSizePxOf(el);
  const anchor = textAnchorToAlign(attr("text-anchor"));
  const wPx = estimateTextWidthPx(text, fontSizePx);
  const hPx = fontSizePx * 1.4;

  // SVG x/y 是锚点基线：按 anchor 反推文本框左上角，并把基线换算为框顶
  const origin = resolveTextOrigin(el);
  let xBox = origin.x;
  if (anchor === "center") xBox -= wPx / 2;
  else if (anchor === "right") xBox -= wPx;
  const yBox = origin.y - fontSizePx * BASELINE_ASCENT;

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

// 解析 path d 的近似包围盒（控制点一并计入，略微放大，安全侧）。
// pptxgenjs 无 custGeom API，闭合填充 path 只能降级为包围盒矩形。
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
  if (!hasFill && (!stroke || stroke === "none")) return;

  // 几何优先取非标准 x/y/width/height 属性（生成约定），否则从 d 解析包围盒
  let bx: number;
  let by: number;
  let bw: number;
  let bh: number;
  const rawW = el.getAttribute("width");
  const rawH = el.getAttribute("height");
  if (rawW != null && rawH != null && num(rawW) > 0 && num(rawH) > 0) {
    bx = num(el.getAttribute("x"));
    by = num(el.getAttribute("y"));
    bw = num(rawW);
    bh = num(rawH);
  } else {
    const d = el.getAttribute("d");
    if (!d) return;
    const bbox = parsePathBBox(d);
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) return;
    bx = bbox.x;
    by = bbox.y;
    bw = bbox.w;
    bh = bbox.h;
  }

  const rectOpts = {
    x: toX(bx),
    y: toY(by),
    w: toW(bw),
    h: toH(bh),
  };
  if (hasFill) {
    const fill = fillWithTransparency(
      resolveFill({ fill: fillAttr }, defsById),
      el,
    );
    slide.addShape("rect", { ...rectOpts, fill, line: shapeLine(el) });
  } else {
    slide.addShape("rect", {
      ...rectOpts,
      fill: { type: "none" },
      line: shapeLine(el),
    });
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
  const fill = fillWithTransparency(
    resolveFill({ fill: el.getAttribute("fill") ?? "#000000" }, defsById),
    el,
  );
  slide.addShape("rect", {
    x: toX(minX),
    y: toY(minY),
    w: toW(w),
    h: toH(h),
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
  slide.addShape("line", {
    x: toX(minX),
    y: toY(minY),
    w: toW(Math.max(w, 0.01)),
    h: toH(Math.max(h, 0.01)),
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
  slide.addImage({
    data: href.replace(/^data:/, ""),
    x: toX(num(el.getAttribute("x"))),
    y: toY(num(el.getAttribute("y"))),
    w: toW(w),
    h: toH(h),
  });
}
