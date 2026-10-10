import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";
import { blockCapacity, maxCharsPerLine } from "./text-measure";

/**
 * 确定性版式骨架（参照 PPT Master executor「先查表再动笔」）：
 * 按语义角色把每页的文本区块坐标与字数预算算死，注入 prompt——
 * 模型只负责配色、装饰与在框内落字，不再自由决策几何。
 * 这是 4B 级本地模型与前沿模型版式差距的最大杠杆：
 * 版式错误（溢出/重叠/失衡）在坐标下发时就被算术消灭。
 */

export interface SkeletonBox {
  kind: "title" | "subtitle" | "bullet" | "column" | "kpi" | "node" | "quote";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 使用 SpecLock.typography 的哪个字号锚点 */
  fontRole?: "title" | "section" | "body" | "caption" | "hero";
  /** 该区块预排的文本（标题/要点原文，供确定性落字） */
  text?: string;
}

export interface LayoutSkeleton {
  boxes: SkeletonBox[];
  /** 注入 prompt 的坐标表 + 预算表 */
  promptBlock: string;
}

const GAP = 24;

function fontOf(spec: SpecLock, role: SkeletonBox["fontRole"]): number {
  const t = spec.typography;
  if (!t) {
    return role === "title" ? 44 : role === "hero" ? 72 : role === "caption" ? 16 : 24;
  }
  return role && t[role] ? t[role] : t.body;
}

function budgetLine(spec: SpecLock, b: SkeletonBox): string {
  const fs = fontOf(spec, b.fontRole);
  if (b.fontRole === "hero" || b.kind === "node") {
    const cap = blockCapacity(b.w, b.h, fs);
    return `字号约 ${fs}px，最多 ${Math.max(1, cap.lines)} 行`;
  }
  const cap = blockCapacity(b.w, b.h, fs);
  return `字号 ${fs}px：每行最多 ${cap.perLine} 字，最多 ${Math.max(1, cap.lines)} 行`;
}

function renderBox(spec: SpecLock, b: SkeletonBox): string {
  const label =
    b.kind === "title"
      ? "标题带"
      : b.kind === "subtitle"
        ? "副标题"
        : b.kind === "bullet"
          ? `要点区块`
          : b.kind === "column"
            ? "分栏"
            : b.kind === "kpi"
              ? "KPI 卡"
              : b.kind === "node"
                ? "节点标签"
                : "金句区";
  const text = b.text ? `（内容：「${b.text.slice(0, 24)}」）` : "";
  return `- ${label}${text}: x=${b.x} y=${b.y} w=${b.w} h=${b.h}；${budgetLine(spec, b)}`;
}

function titleBox(spec: SpecLock, title: string, margin: number, w: number): SkeletonBox {
  const fs = fontOf(spec, "title");
  const perLine = maxCharsPerLine(w - 2 * margin, fs);
  const lines = Math.ceil(Math.max(1, title.length) / Math.max(1, perLine));
  return {
    kind: "title",
    fontRole: "title",
    x: margin,
    y: margin,
    w: w - 2 * margin,
    h: Math.round(fs * 1.3 * Math.min(2, Math.max(1, lines))),
    text: title,
  };
}

function stackBullets(
  spec: SpecLock,
  bullets: string[],
  top: number,
  bottom: number,
  margin: number,
  w: number,
): SkeletonBox[] {
  const n = bullets.length;
  if (n === 0) return [];
  const area = bottom - top;
  const rowH = Math.max(fontOf(spec, "body") * 1.5, Math.floor(area / n) - 8);
  const gap = Math.min(GAP, Math.max(12, Math.floor((area - rowH * n) / (n + 1))));
  const boxes: SkeletonBox[] = [];
  let y = top + gap;
  for (const text of bullets) {
    boxes.push({
      kind: "bullet",
      fontRole: "body",
      x: margin + 8,
      y,
      w: w - 2 * margin - 56,
      h: rowH,
      text,
    });
    y += rowH + gap;
  }
  return boxes;
}

function skeletonFor(
  plan: PagePlanItem,
  spec: SpecLock,
  variant = 0,
): { boxes: SkeletonBox[]; note?: string } | null {
  const { w, h } = spec.canvas;
  const margin = Math.round(w / 32);
  const contentTop = margin + fontOf(spec, "title") * 1.3 + GAP;
  const bottom = h - margin;
  const bullets = plan.bullets ?? [];
  if (bullets.length > 7) return null; // 超长走通用规则，交由内容层裁剪

  switch (plan.role) {
    case "content": {
      const title = titleBox(spec, plan.title, margin, w);
      // 跨页版式轮换（对标 deck 级多样性）：连续多页 content 默认会拿到完全相同
      // 的「标题带 + 整宽要点」骨架，看着单调。variant=1 时把要点拆成左右两栏
      // 分块堆叠（几何仍程序算定、每栏 ≤4 条防溢出），打破雷同。仅 ≥4 条时启用。
      if (variant === 1 && bullets.length >= 4) {
        const gutter = Math.round(w / 32);
        const colW = Math.floor((w - 2 * margin - gutter) / 2);
        const half = Math.ceil(bullets.length / 2);
        const cols: SkeletonBox[] = [];
        [bullets.slice(0, half), bullets.slice(half)].forEach((items, ci) => {
          const x = margin + ci * (colW + gutter);
          cols.push(
            ...stackBullets(
              spec,
              items,
              title.y + title.h,
              bottom,
              x,
              x + colW,
            ).map((b) => ({ ...b, x: x + 8, w: colW - 40 })),
          );
        });
        return {
          boxes: [title, ...cols],
          note: `双栏要点分块（左 ${half} 条 / 右 ${bullets.length - half} 条，各栏宽 ${colW}px、中缝 ${gutter}px），每栏要点前各配 6-8px 圆点；两栏顶对齐`,
        };
      }
      return {
        boxes: [
          title,
          ...stackBullets(spec, bullets, title.y + title.h, bottom, margin, w),
        ],
        note: "每条要点前画 6-8px 圆点（accent 或 primary 色），圆点 x 比要点文字少 20px、垂直居中于要点首行",
      };
    }
    case "comparison": {
      const title = titleBox(spec, plan.title, margin, w);
      const gutter = Math.round(w / 32);
      const colW = Math.floor((w - 2 * margin - gutter) / 2);
      const half = Math.ceil(bullets.length / 2);
      const cols: SkeletonBox[] = [];
      [bullets.slice(0, half), bullets.slice(half)].forEach((items, ci) => {
        const x = margin + ci * (colW + gutter);
        const header: SkeletonBox = {
          kind: "column",
          fontRole: "section",
          x,
          y: contentTop,
          w: colW,
          h: Math.round(fontOf(spec, "section") * 1.3),
          text: "",
        };
        cols.push(header);
        cols.push(
          ...stackBullets(spec, items, header.y + header.h + 8, bottom, x, x + colW).map((b) => ({
            ...b,
            x: x + 8,
            w: colW - 24,
          })),
        );
      });
      return {
        boxes: [title, ...cols],
        note: `两栏等宽（各 ${colW}px，中缝 ${gutter}px），两栏结构必须一致；每栏第一个区块是栏目标题（字号 section，文字从内容提炼，≤${maxCharsPerLine(colW, fontOf(spec, "section"))} 字），可加 surface 底色标题条；中缝可画 1px 分隔线 x=${margin + colW + Math.floor(gutter / 2)}`,
      };
    }
    case "timeline":
    case "process": {
      const title = titleBox(spec, plan.title, margin, w);
      const n = Math.max(2, bullets.length);
      const span = w - 2 * margin;
      const step = Math.floor(span / n);
      const nodeW = Math.max(12, step - 16);
      const baseY = Math.round(h * 0.52);
      const boxes: SkeletonBox[] = [title];
      for (let i = 0; i < n; i++) {
        const cx = margin + step * i + Math.floor(step / 2);
        const above = i % 2 === 0;
        boxes.push({
          kind: "node",
          fontRole: "body",
          x: Math.round(cx - nodeW / 2),
          y: above ? baseY - Math.round(fontOf(spec, "body") * 3.2) : baseY + 28,
          w: nodeW,
          h: Math.round(fontOf(spec, "body") * 3),
          text: bullets[i] ?? `第${i + 1}步`,
        });
      }
      return {
        boxes,
        note: plan.role === "timeline"
          ? `基线 <line x1="${margin}" y1="${baseY}" x2="${w - margin}" y2="${baseY}" stroke-width="2">，节点圆点半径 7-9px 置于基线上、与每个标签的水平中心对齐；标签上下交替（奇数在上、偶数在下），标签内文字居中（text-anchor="middle"）`
          : `节点圆/圆角方块直径 ${Math.round(fontOf(spec, "body") * 1.6)}px 置于基线 y=${baseY} 上，内部写步骤编号 1-${n}；节点间用 2px 箭头线段连接（marker 不允许，用 polygon 画箭头）；标签居中于节点正上/正下方`,
      };
    }
    case "metrics": {
      const title = titleBox(spec, plan.title, margin, w);
      const n = Math.min(3, Math.max(1, bullets.length));
      const gutter = Math.round(w / 40);
      const cardW = Math.floor((w - 2 * margin - gutter * (n - 1)) / n);
      const cardY = Math.round(h * 0.3);
      const cardH = Math.round(h * 0.44);
      const boxes: SkeletonBox[] = [title];
      for (let i = 0; i < n; i++) {
        boxes.push({
          kind: "kpi",
          fontRole: "hero",
          x: margin + i * (cardW + gutter),
          y: cardY,
          w: cardW,
          h: cardH,
          text: bullets[i] ?? "",
        });
      }
      return {
        boxes,
        note: `每张 KPI 卡内部：大数字区 = 卡片上半（${cardW}×${Math.round(cardH * 0.55)}，字号 hero，水平居中）；说明标签 = 卡片下半（caption/section 字号，居中）。卡片可加 surface 底色与圆角，坐标不得改`,
      };
    }
    case "quote": {
      const qW = Math.round((w - 2 * margin) * 0.78);
      const qX = Math.round((w - qW) / 2);
      const quote: SkeletonBox = {
        kind: "quote",
        fontRole: "title",
        x: qX,
        y: Math.round(h * 0.3),
        w: qW,
        h: Math.round(h * 0.34),
        text: plan.quote ?? plan.title,
      };
      const attr: SkeletonBox = {
        kind: "subtitle",
        fontRole: "caption",
        x: qX,
        y: quote.y + quote.h + 16,
        w: qW,
        h: Math.round(fontOf(spec, "caption") * 1.5),
        text: plan.attribution ?? "",
      };
      return {
        boxes: [quote, attr],
        note: "金句用大字号（title 或 hero，取决于长度，超出预算必须用 title），可加超大引号装饰或左侧 accent 竖条；出处右对齐或与金句左缘对齐，其余全部弱化、大量留白",
      };
    }
    default:
      return null;
  }
}

/**
 * 构造该页版式骨架。cover/section/closing 与图表页返回 null
 * （封面重氛围、图表页有 data-chart 约定，均不适合坐标下发）。
 * variant：正文页版式变体（0 整宽列表 / 1 双栏分块），由 deck 生成环按相邻同角色
 * 页轮换，打破「连续 content 页版式雷同」——几何仍由程序算定，不牺牲防溢出保证。
 */
export function buildLayoutSkeleton(
  plan: PagePlanItem,
  spec: SpecLock,
  opts?: { variant?: number },
): LayoutSkeleton | null {
  if (plan.chartType) return null;
  const variant = opts?.variant ?? 0;
  const built = skeletonFor(plan, spec, variant);
  if (!built || built.boxes.length === 0) return null;
  const lines = built.boxes.map((b) => renderBox(spec, b));
  const rotate =
    plan.role === "content" &&
    variant === 1 &&
    !plan.chartType &&
    (plan.bullets?.length ?? 0) >= 4
      ? "\n多样性提示：本页与上一页同为正文页，已切换为双栏分块版式以避免雷同，请保持双栏结构。"
      : "";
  const block = `## 本页版式骨架（坐标由程序算定，必须严格遵循）
${lines.join("\n")}
落字规则：每个区块的文字以其 x 为左缘；y 为区块顶，首行基线 = y + 字号；多行用 <tspan>，x 同区块 x、行距 dy = 字号×1.2。区块间距与尺寸不可改变，可改的只有：配色、圆角、底色、分隔线、装饰图形、字号在锚点 ±2px 内。${built.note ? `\n结构补充：${built.note}` : ""}${rotate}`;
  return { boxes: built.boxes, promptBlock: block };
}
