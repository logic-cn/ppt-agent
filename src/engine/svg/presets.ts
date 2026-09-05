/**
 * 预设形状词表（参照 PPT Master preset_shape_svg.py / native-shape-authoring）。
 *
 * 三方契约：
 * - LLM 以 `<rect data-prst="chevron" x y width height fill/>` 表达预设形状意图；
 * - `finalizeSvgPresets` 在生成端把它规范化为带 data-prst 的 `<path>`（预览渲染保真）；
 * - 导出端按 data-prst 映射 PowerPoint 原生 prstGeom（可编辑原生形状，而非降级矩形）。
 */

export interface PresetShapeDef {
  /** PowerPoint prst / pptxgenjs ShapeType 名称 */
  id: string;
  /** 用途说明（提示词词汇表用） */
  usage: string;
  /** 生成规范化路径 d（包围盒 [0,0,w,h] 内的绝对坐标） */
  path: (w: number, h: number) => string;
}

function n(v: number): string {
  // 保留 2 位小数，去掉多余尾零，保持 SVG 紧凑
  return String(Math.round(v * 100) / 100);
}

function starPoints(
  w: number,
  h: number,
  points: number,
  innerRatio: number,
): string {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(w, h) / 2;
  const inner = outer * innerRatio;
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // 从正上方（-90°）开始顺时针
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(
      `${n(cx + r * Math.cos(angle))},${n(cy + r * Math.sin(angle))}`,
    );
  }
  return `M${coords.join(" L")} Z`;
}

export const PRESET_SHAPES: Record<string, PresetShapeDef> = {
  chevron: {
    id: "chevron",
    usage: "V 形箭头（步骤推进、时间线节点方向）",
    path: (w, h) => {
      const d = w * 0.2;
      return `M0,0 L${n(w - d)},0 L${n(w)},${n(h / 2)} L${n(w - d)},${n(h)} L0,${n(h)} L${n(d)},${n(h / 2)} Z`;
    },
  },
  homePlate: {
    id: "homePlate",
    usage: "五边形箭头（流程终点、阶段块）",
    path: (w, h) => {
      const d = Math.min(w, h) / 2;
      return `M0,0 L${n(w - d)},0 L${n(w)},${n(h / 2)} L${n(w - d)},${n(h)} L0,${n(h)} Z`;
    },
  },
  rightArrow: {
    id: "rightArrow",
    usage: "右向箭头（推进方向）",
    path: (w, h) => {
      const head = Math.min(w * 0.4, h * 0.6);
      const sh = h * 0.5;
      const yTop = (h - sh) / 2;
      const yBot = (h + sh) / 2;
      return `M0,${n(yTop)} L${n(w - head)},${n(yTop)} L${n(w - head)},0 L${n(w)},${n(h / 2)} L${n(w - head)},${n(h)} L${n(w - head)},${n(yBot)} L0,${n(yBot)} Z`;
    },
  },
  leftArrow: {
    id: "leftArrow",
    usage: "左向箭头（回溯、对照方向）",
    path: (w, h) => {
      const head = Math.min(w * 0.4, h * 0.6);
      const sh = h * 0.5;
      const yTop = (h - sh) / 2;
      const yBot = (h + sh) / 2;
      return `M${n(w)},${n(yTop)} L${n(head)},${n(yTop)} L${n(head)},0 L0,${n(h / 2)} L${n(head)},${n(h)} L${n(head)},${n(yBot)} L${n(w)},${n(yBot)} Z`;
    },
  },
  upArrow: {
    id: "upArrow",
    usage: "上向箭头（增长、提升）",
    path: (w, h) => {
      const head = Math.min(h * 0.4, w * 0.6);
      const sw = w * 0.5;
      const xL = (w - sw) / 2;
      const xR = (w + sw) / 2;
      return `M${n(xL)},${n(h)} L${n(xL)},${n(head)} L0,${n(head)} L${n(w / 2)},0 L${n(w)},${n(head)} L${n(xR)},${n(head)} L${n(xR)},${n(h)} Z`;
    },
  },
  downArrow: {
    id: "downArrow",
    usage: "下向箭头（下降、下发）",
    path: (w, h) => {
      const head = Math.min(h * 0.4, w * 0.6);
      const sw = w * 0.5;
      const xL = (w - sw) / 2;
      const xR = (w + sw) / 2;
      return `M${n(xL)},0 L${n(xL)},${n(h - head)} L0,${n(h - head)} L${n(w / 2)},${n(h)} L${n(w)},${n(h - head)} L${n(xR)},${n(h - head)} L${n(xR)},0 Z`;
    },
  },
  triangle: {
    id: "triangle",
    usage: "三角形（警示、层级顶点）",
    path: (w, h) => `M${n(w / 2)},0 L${n(w)},${n(h)} L0,${n(h)} Z`,
  },
  diamond: {
    id: "diamond",
    usage: "菱形（决策节点、高亮）",
    path: (w, h) =>
      `M${n(w / 2)},0 L${n(w)},${n(h / 2)} L${n(w / 2)},${n(h)} L0,${n(h / 2)} Z`,
  },
  hexagon: {
    id: "hexagon",
    usage: "六边形（模块、集群）",
    path: (w, h) => {
      const d = w * 0.2;
      return `M${n(d)},0 L${n(w - d)},0 L${n(w)},${n(h / 2)} L${n(w - d)},${n(h)} L${n(d)},${n(h)} L0,${n(h / 2)} Z`;
    },
  },
  trapezoid: {
    id: "trapezoid",
    usage: "梯形（底座、漏斗层）",
    path: (w, h) => {
      const d = w * 0.2;
      return `M${n(d)},0 L${n(w - d)},0 L${n(w)},${n(h)} L0,${n(h)} Z`;
    },
  },
  parallelogram: {
    id: "parallelogram",
    usage: "平行四边形（输入/输出节点）",
    path: (w, h) => {
      const s = w * 0.2;
      return `M${n(s)},0 L${n(w)},0 L${n(w - s)},${n(h)} L0,${n(h)} Z`;
    },
  },
  star5: {
    id: "star5",
    usage: "五角星（评分、亮点标记）",
    path: (w, h) => starPoints(w, h, 5, 0.382),
  },
  flowChartTerminator: {
    id: "flowChartTerminator",
    usage: "流程起止框（ stadium 圆角端）",
    path: (w, h) => {
      const r = Math.min(h / 2, w / 2);
      return `M${n(r)},0 L${n(w - r)},0 A${n(r)},${n(r)} 0 0 1 ${n(w - r)},${n(h)} L${n(r)},${n(h)} A${n(r)},${n(r)} 0 0 1 ${n(r)},0 Z`;
    },
  },
};

export function isPresetShape(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRESET_SHAPES, id);
}

/** 预设形状词汇表提示词模块（svg-gen 条件注入） */
export const PRESET_VOCAB_PROMPT = `## 预设形状词汇表（关系图/流程图的矢量形状）
用 <rect data-prst="名称" x=".." y=".." width=".." height=".." fill=".."/> 表达预设形状，
导出为 PowerPoint 原生可编辑形状；不要手绘近似路径代替这些形状：
${Object.values(PRESET_SHAPES)
  .map((s) => `- ${s.id}：${s.usage}`)
  .join("\n")}`;

/** data-prst 属性正则（rect 载体） */
const PRST_RECT_RE =
  /<rect\s([^>]*\bdata-prst\s*=\s*"([^"]+)"[^>]*)\/?\s*>(?:<\/rect>)?/gi;

/** 保留到 path 上的绘制属性 */
const PAINT_ATTRS = [
  "fill",
  "fill-opacity",
  "opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "transform",
  "class",
] as const;

function attrValue(attr: string, name: string): string | undefined {
  const m = attr.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : undefined;
}

/**
 * 规范化：把 `<rect data-prst="X">` 改写为带 data-prst 的 canonical `<path>`。
 * 预览端得到真实形状渲染；导出端仍按 data-prst 走原生 prstGeom。
 * 幂等：已是 path 或未知 prst 的元素原样保留。
 */
export function finalizeSvgPresets(svg: string): string {
  return svg.replace(PRST_RECT_RE, (full, attrs: string, id: string) => {
    if (!isPresetShape(id)) return full;
    const w = Number.parseFloat(attrValue(attrs, "width") ?? "0");
    const h = Number.parseFloat(attrValue(attrs, "height") ?? "0");
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return full;
    }
    const x = Number.parseFloat(attrValue(attrs, "x") ?? "0");
    const y = Number.parseFloat(attrValue(attrs, "y") ?? "0");
    const dx = Number.isFinite(x) ? x : 0;
    const dy = Number.isFinite(y) ? y : 0;
    // 平移到 rect 的 (x,y)；有 transform 时保持原属性由渲染端处理
    const raw = PRESET_SHAPES[id].path(w, h);
    const d = dx === 0 && dy === 0 ? raw : translatePathD(raw, dx, dy);
    const paint = PAINT_ATTRS.map((name) => {
      const v = attrValue(attrs, name);
      return v === undefined ? "" : ` ${name}="${v}"`;
    }).join("");
    return `<path d="${d}" data-prst="${id}"${paint}/>`;
  });
}

/** 把路径 d 整体平移 (dx,dy)（仅处理绝对坐标段 M/L/A 的终点坐标） */
function translatePathD(d: string, dx: number, dy: number): string {
  return d.replace(/([MLA])([^MLAZ]*)/gi, (full, cmd: string, args: string) => {
    if (cmd.toUpperCase() === "A") {
      // 弧段：仅平移终点（倒数第 2、1 个参数），rx/ry/旋转/标志位不动
      const nums = args.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
      if (nums.length >= 7) {
        const head = nums.slice(0, 5);
        const ex = Number.parseFloat(nums[5]) + dx;
        const ey = Number.parseFloat(nums[6]) + dy;
        return `${cmd}${head.join(",")},${ex},${ey}`;
      }
      return full;
    }
    const nums = (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    const moved = nums.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
    return `${cmd}${moved.map(n).join(",")}`;
  });
}
