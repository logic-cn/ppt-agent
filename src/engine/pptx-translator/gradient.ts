// pptxgenjs 4.0.1 的 ShapeFillProps.fill.type 仅支持 'none' | 'solid'，不支持渐变。
// 因此原生 PPTX 渐变无法通过官方 API 表达。本模块采用务实降级策略：
// 当 SVG 元素使用 linearGradient / radialGradient 填充时，解析其 <stop> 颜色，
// 取首 stop 与末 stop 的平均色作为 solid 兜底色返回，保证不崩溃且视觉相对柔和。
// 解析口径：SVG fill 属性既可能是纯色（#abc）也可能是 url(#id) 引用 <defs> 中的渐变。

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
