/**
 * 文本测量校准（参照 PPT Master text_measure.py calibrate）：
 * 宽度估算与 pptx-translator 的 glyphWidthPx 口径完全一致——
 * CJK 全角按 1.0 字号、其余按 0.55 字号，尾部 +0.4em。
 * 生成侧与校验侧共用这一份算术：模型拿到的「每行可容纳 N 字」
 * 与导出时的换行计算同源，页面就不会溢出。
 */

export function estimateTextWidthPx(text: string, fontSizePx: number): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55;
  }
  return Math.max(w + fontSizePx * 0.4, fontSizePx);
}

/** 文本节点内容转义（SVG/XML 实体五字符） */
export function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 每行可容纳字符数（保守按全宽 CJK 计）：width 内扣除 0.4em 尾距。
 * 用于生成前给模型下发「标题最多 N 字 / 每条要点每行 M 字」的硬预算。
 */
export function maxCharsPerLine(widthPx: number, fontSizePx: number): number {
  if (widthPx <= 0 || fontSizePx <= 0) return 0;
  return Math.max(0, Math.floor((widthPx - fontSizePx * 0.4) / fontSizePx));
}

/** 块内总容量（字数）：行数 × 每行字数 */
export function blockCapacity(
  widthPx: number,
  heightPx: number,
  fontSizePx: number,
  leading = 1.5,
): { perLine: number; lines: number; totalChars: number } {
  const perLine = maxCharsPerLine(widthPx, fontSizePx);
  const lines = Math.max(0, Math.floor(heightPx / (fontSizePx * leading)));
  return { perLine, lines, totalChars: perLine * lines };
}

/** 按估算宽度贪心换行：CJK 逐字断、拉丁按词断（与 translator 换行策略一致） */
export function wrapTextToWidth(
  text: string,
  fontSizePx: number,
  maxWidthPx: number,
): string[] {
  const lines: string[] = [];
  const wrapParagraph = (para: string) => {
    if (!para) {
      lines.push("");
      return;
    }
    // 词元：CJK 逐字成元，拉丁按空白分段成词
    const tokens: string[] = [];
    let buf = "";
    for (const ch of para) {
      if (ch.charCodeAt(0) > 0x2e80) {
        if (buf) {
          tokens.push(buf);
          buf = "";
        }
        tokens.push(ch);
      } else if (ch === " " || ch === "\t") {
        if (buf) {
          tokens.push(buf);
          buf = "";
        }
      } else {
        buf += ch;
      }
    }
    if (buf) tokens.push(buf);
    const tokenWidth = (t: string) =>
      [...t].reduce(
        (w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? fontSizePx : fontSizePx * 0.55),
        0,
      );
    let cur = "";
    let curW = 0;
    for (const t of tokens) {
      const tw = tokenWidth(t);
      const lastChar = cur ? cur.charCodeAt(cur.length - 1) : 0;
      const needsSpace =
        cur && t.charCodeAt(0) <= 0x2e80 && lastChar <= 0x2e80;
      const gap = needsSpace ? fontSizePx * 0.3 : 0;
      if (cur && curW + gap + tw > maxWidthPx) {
        lines.push(cur);
        cur = t;
        curW = tw;
      } else {
        cur += (needsSpace ? " " : "") + t;
        curW += gap + tw;
      }
    }
    lines.push(cur || "");
  };
  for (const para of text.split("\n")) wrapParagraph(para);
  return lines.length > 0 ? lines : [""];
}

/**
 * 生成侧防溢出护栏：把一段文本确定性排布进给定盒子——
 * 按估算宽度贪心换行成 <tspan> 行序列，超出盒高截断行数。
 * 骨架驱动的页面用它替代模型的自由排版（ppt-master 用小模型的核心
 * 手法：几何由代码算，文本由模型写）。y 为基线：首行基线落在 box.y + fontSize。
 */
export function renderFittedText(
  box: { x: number; y: number; w: number; h: number },
  fontSizePx: number,
  text: string,
  opts?: { fill?: string; anchor?: "start" | "middle" | "end" },
): string {
  const lines = wrapTextToWidth(text, fontSizePx, box.w);
  const maxLines = Math.max(1, Math.floor(box.h / (fontSizePx * 1.2)));
  const kept = lines.slice(0, maxLines);
  const anchorX = Math.min(Math.max(box.x, 0), box.x + box.w);
  const baseY = box.y + fontSizePx;
  const fillAttr = opts?.fill ? ` fill="${opts.fill}"` : "";
  const anchorAttr = opts?.anchor ? ` text-anchor="${opts.anchor}"` : "";
  const open = `<text x="${anchorX}" y="${baseY}" font-size="${fontSizePx}"${fillAttr}${anchorAttr}>`;
  if (kept.length === 1) {
    return `${open}${escapeXmlText(kept[0])}</text>`;
  }
  const step = Math.round(fontSizePx * 1.2);
  const tspans = kept
    .map(
      (l, i) =>
        `<tspan x="${anchorX}" dy="${i === 0 ? 0 : step}">${escapeXmlText(l)}</tspan>`,
    )
    .join("");
  return `${open}${tspans}</text>`;
}
