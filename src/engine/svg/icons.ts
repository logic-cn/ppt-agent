/**
 * 内置图标词表（C1，参照 PPT Master 图标库与 `<use data-icon>` 契约）。
 *
 * 与 PPT Master 的差异：其转换器支持 freeform path， ours 只有预设形状——
 * 因此每个图标定义为「基本形状 / 预设形状的组合配方」：
 * - LLM 以 `<rect data-icon="clock" x y width height fill/>` 表达图标意图；
 * - `finalizeSvgIcons` 展开为绝对坐标的形状序列（预览所见即图标）；
 * - 展开产物全部落在现有 translator 白名单内（rect/circle/ellipse/line/path），
 *   导出即原生可编辑形状，无需改动翻译器。
 */

export interface IconPart {
  kind: "rect" | "circle" | "ellipse" | "line" | "path";
  /** 24×24 图标坐标系 */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  rx?: number;
  /** line：端点 */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** path：d（不含 data-prst 时仅限可被 classifyPath 识别的形状） */
  d?: string;
  /** 预设形状 id（path 部件可选携带，translator 映射原生 prstGeom） */
  prst?: string;
  /** line/空心部件：用描边而非填充 */
  lineOnly?: boolean;
}

export interface IconDef {
  id: string;
  usage: string;
  parts: IconPart[];
}

export const ICONS: Record<string, IconDef> = {
  check: {
    id: "check",
    usage: "已完成/优点标记",
    parts: [
      { kind: "line", x1: 5, y1: 13, x2: 10, y2: 18 },
      { kind: "line", x1: 10, y1: 18, x2: 19, y2: 7 },
    ],
  },
  cross: {
    id: "cross",
    usage: "缺点/否定标记",
    parts: [
      { kind: "line", x1: 6, y1: 6, x2: 18, y2: 18 },
      { kind: "line", x1: 18, y1: 6, x2: 6, y2: 18 },
    ],
  },
  target: {
    id: "target",
    usage: "目标/定位",
    parts: [
      { kind: "circle", x: 12, y: 12, r: 10, lineOnly: true },
      { kind: "circle", x: 12, y: 12, r: 6, lineOnly: true },
      { kind: "circle", x: 12, y: 12, r: 2.5 },
    ],
  },
  clock: {
    id: "clock",
    usage: "时间/周期",
    parts: [
      { kind: "circle", x: 12, y: 12, r: 10, lineOnly: true },
      { kind: "line", x1: 12, y1: 12, x2: 12, y2: 6.5 },
      { kind: "line", x1: 12, y1: 12, x2: 16.5, y2: 14 },
    ],
  },
  mail: {
    id: "mail",
    usage: "联系/邮件",
    parts: [
      { kind: "rect", x: 2, y: 5, w: 20, h: 14, rx: 2, lineOnly: true },
      { kind: "line", x1: 3, y1: 6.5, x2: 12, y2: 13 },
      { kind: "line", x1: 21, y1: 6.5, x2: 12, y2: 13 },
    ],
  },
  phone: {
    id: "phone",
    usage: "电话/移动端",
    parts: [
      { kind: "rect", x: 6, y: 2, w: 12, h: 20, rx: 3, lineOnly: true },
      { kind: "circle", x: 12, y: 18, r: 1.3 },
    ],
  },
  chartBar: {
    id: "chartBar",
    usage: "数据/统计",
    parts: [
      { kind: "rect", x: 4, y: 12, w: 4, h: 8 },
      { kind: "rect", x: 10, y: 8, w: 4, h: 12 },
      { kind: "rect", x: 16, y: 4, w: 4, h: 16 },
    ],
  },
  chartTrend: {
    id: "chartTrend",
    usage: "增长/趋势",
    parts: [
      { kind: "line", x1: 4, y1: 18, x2: 12, y2: 10 },
      { kind: "line", x1: 12, y1: 10, x2: 20, y2: 4 },
      { kind: "circle", x: 4, y: 18, r: 2 },
      { kind: "circle", x: 12, y: 10, r: 2 },
      { kind: "circle", x: 20, y: 4, r: 2 },
    ],
  },
  doc: {
    id: "doc",
    usage: "文档/报告",
    parts: [
      { kind: "rect", x: 5, y: 2, w: 14, h: 20, rx: 2, lineOnly: true },
      { kind: "line", x1: 8, y1: 8, x2: 16, y2: 8 },
      { kind: "line", x1: 8, y1: 12, x2: 16, y2: 12 },
      { kind: "line", x1: 8, y1: 16, x2: 13, y2: 16 },
    ],
  },
  folder: {
    id: "folder",
    usage: "归档/分类",
    parts: [
      { kind: "rect", x: 2, y: 6, w: 20, h: 14, rx: 2, lineOnly: true },
      { kind: "rect", x: 2, y: 3, w: 9, h: 5, rx: 1 },
    ],
  },
  calendar: {
    id: "calendar",
    usage: "日程/周期",
    parts: [
      { kind: "rect", x: 3, y: 5, w: 18, h: 17, rx: 2, lineOnly: true },
      { kind: "line", x1: 3, y1: 10, x2: 21, y2: 10 },
      { kind: "line", x1: 8, y1: 2, x2: 8, y2: 7 },
      { kind: "line", x1: 16, y1: 2, x2: 16, y2: 7 },
    ],
  },
  home: {
    id: "home",
    usage: "首页/住宅",
    parts: [
      { kind: "path", d: "M12,3 L22,12 L2,12 Z", prst: "triangle" },
      { kind: "rect", x: 5, y: 12, w: 14, h: 9 },
    ],
  },
  pin: {
    id: "pin",
    usage: "位置/地点",
    parts: [
      { kind: "circle", x: 12, y: 9, r: 5.5, lineOnly: true },
      { kind: "line", x1: 7, y1: 13, x2: 12, y2: 21.5 },
      { kind: "line", x1: 17, y1: 13, x2: 12, y2: 21.5 },
      { kind: "circle", x: 12, y: 9, r: 2 },
    ],
  },
  coin: {
    id: "coin",
    usage: "成本/预算",
    parts: [
      { kind: "circle", x: 12, y: 12, r: 10, lineOnly: true },
      { kind: "circle", x: 12, y: 12, r: 6.5, lineOnly: true },
    ],
  },
  user: {
    id: "user",
    usage: "用户/受众",
    parts: [
      { kind: "circle", x: 12, y: 7, r: 4.5 },
      { kind: "rect", x: 4, y: 14, w: 16, h: 8, rx: 4 },
    ],
  },
  flag: {
    id: "flag",
    usage: "里程碑/目标点",
    parts: [
      { kind: "line", x1: 6, y1: 2, x2: 6, y2: 22 },
      { kind: "rect", x: 6, y: 3, w: 14, h: 6 },
    ],
  },
};

export function isIcon(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICONS, id);
}

/** 图标词汇表提示词模块 */
export const ICON_VOCAB_PROMPT = `## 内置图标词汇表（图标必须用这里的数据-icon 标记，不要手绘）
用 <rect data-icon="名称" x=".." y=".." width=".." height=".." fill=".."/> 表达单色图标
（width/height 建议相等；fill 取配色表颜色，导出为原生可编辑形状）：
${Object.values(ICONS)
  .map((i) => `- ${i.id}：${i.usage}`)
  .join("\n")}`;

function f(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** 渲染单个部件（color 为 LLM 指定的图标色；size 为目标边长） */
function renderPart(
  part: IconPart,
  ox: number,
  oy: number,
  size: number,
  color: string,
): string {
  const k = size / 24;
  const strokeW = Math.max(1.5, size / 14);
  const stroke = ` stroke="${color}" stroke-width="${f(strokeW)}" stroke-linecap="round" fill="none"`;
  switch (part.kind) {
    case "rect":
      return (
        `<rect x="${f(ox + (part.x ?? 0) * k)}" y="${f(oy + (part.y ?? 0) * k)}"` +
        ` width="${f((part.w ?? 0) * k)}" height="${f((part.h ?? 0) * k)}"` +
        (part.rx ? ` rx="${f(part.rx * k)}"` : "") +
        ` fill="${color}"/>`
      );
    case "circle":
      return (
        `<circle cx="${f(ox + (part.x ?? 0) * k)}" cy="${f(oy + (part.y ?? 0) * k)}"` +
        ` r="${f((part.r ?? 0) * k)}"` +
        (part.lineOnly ? stroke : ` fill="${color}"`) +
        "/>"
      );
    case "ellipse":
      return (
        `<ellipse cx="${f(ox + (part.x ?? 0) * k)}" cy="${f(oy + (part.y ?? 0) * k)}"` +
        ` rx="${f((part.w ?? 0) * k)}" ry="${f((part.h ?? 0) * k)}"` +
        (part.lineOnly ? stroke : ` fill="${color}"`) +
        "/>"
      );
    case "line":
      return (
        `<line x1="${f(ox + (part.x1 ?? 0) * k)}" y1="${f(oy + (part.y1 ?? 0) * k)}"` +
        ` x2="${f(ox + (part.x2 ?? 0) * k)}" y2="${f(oy + (part.y2 ?? 0) * k)}"` +
        ` stroke="${color}" stroke-width="${f(strokeW)}" stroke-linecap="round"/>`
      );
    case "path": {
      // d 平移缩放到目标 bbox（绝对坐标 M/L/A/Z 命令）
      const d = transformPathD(part.d ?? "", ox, oy, k);
      return `<path d="${d}"${part.prst ? ` data-prst="${part.prst}"` : ""} fill="${color}"/>`;
    }
  }
}

/** 把 24×24 系 path 平移缩放到绝对坐标（仅 M/L/A/Z 绝对命令，图标定义受控） */
function transformPathD(d: string, ox: number, oy: number, k: number): string {
  return d.replace(/([MLA])([^MLAZ]*)/gi, (full, cmd: string, args: string) => {
    const nums = (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    if (cmd.toUpperCase() === "A") {
      if (nums.length < 7) return full;
      const head = nums.slice(0, 5).map((v) => f(v * k));
      const ex = nums[5] * k + ox;
      const ey = nums[6] * k + oy;
      return `${cmd}${head.join(",")},${f(ex)},${f(ey)}`;
    }
    const moved = nums.map((v, i) => (i % 2 === 0 ? v * k + ox : v * k + oy));
    return `${cmd}${moved.map(f).join(",")}`;
  });
}

const ICON_RECT_RE =
  /<rect\s([^>]*\bdata-icon\s*=\s*"([^"]+)"[^>]*)\/?\s*>(?:<\/rect>)?/gi;

/**
 * 规范化：`<rect data-icon="X">` → 图标配方展开的形状序列（绝对坐标）。
 * 幂等；未知 id 原样保留（由 checkSvgIcons 报 error 触发重画）。
 */
export function finalizeSvgIcons(svg: string): string {
  return svg.replace(ICON_RECT_RE, (full, attrs: string, id: string) => {
    if (!isIcon(id)) return full;
    const w = Number.parseFloat(attrVal(attrs, "width") ?? "0");
    const h = Number.parseFloat(attrVal(attrs, "height") ?? "0");
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return full;
    }
    const x = Number(attrVal(attrs, "x") ?? "0") || 0;
    const y = Number(attrVal(attrs, "y") ?? "0") || 0;
    const color = attrVal(attrs, "fill") ?? "#000000";
    // 非正方形 bbox：以 min 边为准居中（图标语义为正方形单元）
    const size = Math.min(w, h);
    const ox = x + (w - size) / 2;
    const oy = y + (h - size) / 2;
    return ICONS[id].parts
      .map((part) => renderPart(part, ox, oy, size, color))
      .join("");
  });
}

function attrVal(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : undefined;
}
