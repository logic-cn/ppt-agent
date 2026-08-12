// pptxgenjs 4.0.1 的 ShapeFillProps.fill.type 仅支持 'none' | 'solid'，不支持渐变。
// 因此原生 PPTX 渐变无法通过官方 API 表达。本模块采用务实降级策略：
// 当 SVG 元素使用 linearGradient / radialGradient 填充时，解析其 <stop> 颜色，
// 取首 stop 与末 stop 的平均色作为 solid 兜底色返回，保证不崩溃且视觉相对柔和。
// 对矩形元素之上的线性渐变，P1-3 进一步把 bbox 按 stop 切分为纵向色块，
// 视觉更接近渐变而不是单一平均色。解析口径：SVG fill 属性既可能是纯色（#abc）
// 也可能是 url(#id) 引用 <defs> 中的渐变。

export interface GradientStop {
  offset: number;
  color: string;
}

export interface GradientDef {
  id: string;
  type: "linear" | "radial";
  stops: GradientStop[];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return (to(r) + to(g) + to(b)).toUpperCase();
}

function normalizeHex(hex: string): string {
  return rgbToHex(...hexToRgb(hex));
}

/**
 * 解析 SVG 字符串中 <defs> 下的所有 linearGradient / radialGradient，
 * 返回 id → 渐变定义 的映射。
 */
export function collectDefs(svg: string): Record<string, GradientDef> {
  const defs: Record<string, GradientDef> = {};
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const gradients = doc.querySelectorAll("linearGradient, radialGradient");
  gradients.forEach((g) => {
    const id = g.getAttribute("id");
    if (!id) return;
    const type =
      g.nodeName.toLowerCase() === "radialGradient" ? "radial" : "linear";
    const stops: GradientStop[] = [];
    g.querySelectorAll("stop").forEach((s) => {
      const color = s.getAttribute("stop-color") ?? "#000000";
      const offset = Number.parseFloat(s.getAttribute("offset") ?? "0") || 0;
      stops.push({ offset, color: normalizeHex(color) });
    });
    if (stops.length > 0) {
      defs[id] = { id, type, stops };
    }
  });
  return defs;
}

export interface ResolvedFill {
  color: string;
  transparency?: number;
}

const warned = new Set<string>();

/**
 * 解析 SVG 元素的填充色。
 * - 纯色 fill（如 #abc）直接返回（去 #）。
 * - fill="url(#g)" 且 defs 中存在对应渐变：取首 stop 与末 stop 的平均色作为 solid 兜底。
 * 渐变降级为纯色属于 pptxgenjs 4.0.1 限制下的务实策略，会向控制台 warn 一次。
 */
export function resolveFill(
  node: { fill?: string | null | undefined },
  defsById: Record<string, GradientDef>,
): ResolvedFill {
  const raw = node.fill;
  if (!raw) return { color: "000000" };

  const urlMatch = raw.match(/url\(\s*#([^\s)]+)\s*\)/);
  if (urlMatch) {
    const id = urlMatch[1];
    const def = defsById[id];
    if (def && def.stops.length > 0) {
      if (!warned.has(id)) {
        warned.add(id);
        console.warn(
          `[pptx-translator] 渐变 "${id}" 降级为纯色（pptxgenjs 不支持渐变填充），取首末 stop 平均色。`,
        );
      }
      const first = hexToRgb(def.stops[0].color);
      const last = hexToRgb(def.stops[def.stops.length - 1].color);
      const avg = rgbToHex(
        (first[0] + last[0]) / 2,
        (first[1] + last[1]) / 2,
        (first[2] + last[2]) / 2,
      );
      return { color: avg };
    }
    // 引用了不存在的 defs，降级为该元素的纯色（无法解析则返回黑）
    return { color: "000000" };
  }

  return { color: normalizeHex(raw) };
}

export interface ResolvedGradientFill {
  /** 首末平均色兜底（非渐变或无法映射时使用） */
  color: string;
  /** 渐变定义（存在时为 url(#id) 引用，可用于分段近似） */
  gradient?: GradientDef;
}

/**
 * P1-3：解析元素填充的完整信息。
 * 与 resolveFill 区别：保留 gradient 定义供矩形分段近似使用；
 * 对不支持分段的形状仍取首末平均色兜底。
 */
export function resolveGradientFill(
  node: { fill?: string | null | undefined },
  defsById: Record<string, GradientDef>,
): ResolvedGradientFill {
  const raw = node.fill;
  const plain = resolveFill(node, defsById);
  if (!raw) return { color: plain.color };
  const urlMatch = raw.match(/url\(\s*#([^\s)]+)\s*\)/);
  if (urlMatch) {
    const def = defsById[urlMatch[1]];
    if (def && def.stops.length > 0) {
      return { color: plain.color, gradient: def };
    }
  }
  return { color: plain.color };
}

/**
 * 计算渐变在某相对位置 t∈[0,1] 的插值色（按 stop.offset 分段线性）。
 */
export function sampleGradient(stops: GradientStop[], t: number): string {
  if (stops.length === 0) return "000000";
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const clamp = Math.max(0, Math.min(1, t));
  if (clamp <= sorted[0].offset) return sorted[0].color;
  const last = sorted[sorted.length - 1];
  if (clamp >= last.offset) return last.color;
  let i = 0;
  while (i + 1 < sorted.length && sorted[i + 1].offset < clamp) i++;
  const a = sorted[i];
  const b = sorted[i + 1];
  const span = b.offset - a.offset || 1;
  const k = (clamp - a.offset) / span;
  const ca = hexToRgb(a.color);
  const cb = hexToRgb(b.color);
  return rgbToHex(
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  );
}
