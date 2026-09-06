/**
 * 确定性图片嵌入（B7）：把 data URL 图片作为底层画面嵌入 X1 页面 SVG，
 * 叠加设计锁底色的半透明遮罩保证文字可读——不经 LLM，零成本可撤销（undo 历史）。
 * 参照 PPT Master svg-image-embedding 的底图 + scrim 构图。
 */

import { checkSvg } from "./quality/checker";
import type { SpecLock } from "@/design/spec-lock";

/** 从 SVG 根元素读取 viewBox 尺寸（缺省 1280×720） */
function canvasSizeOf(svg: string): { w: number; h: number } {
  const m = svg.match(
    /viewBox\s*=\s*["']0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/i,
  );
  const w = m ? Number.parseFloat(m[1]) : 1280;
  const h = m ? Number.parseFloat(m[2]) : 720;
  return { w: Number.isFinite(w) ? w : 1280, h: Number.isFinite(h) ? h : 720 };
}

/** 转义 data URL 中的 XML 属性特殊字符（& 与引号） */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const EMBED_MARK = 'data-embed="web"';

/** 移除既有嵌入层（image/遮罩/署名，重复应用时替换而非叠加） */
function stripEmbeddedLayers(svg: string): string {
  return svg
    .replace(new RegExp(`<image\\b[^>]*\\b${EMBED_MARK}[^>]*/>`, "gi"), "")
    .replace(new RegExp(`<rect\\b[^>]*\\b${EMBED_MARK}[^>]*/>`, "gi"), "")
    .replace(
      new RegExp(`<text\\b[^>]*\\b${EMBED_MARK}[^>]*>[^<]*</text>`, "gi"),
      "",
    );
}

/**
 * 在页面 SVG 底层嵌入图片：
 * <image>（preserveAspectRatio slice 铺满画布）+ 底色 45% 遮罩，
 * 两层均带 data-embed="web" 标记——重复嵌入会先移除旧层（替换语义）。
 * 图片插在根元素第一个子节点之前——位于全部内容之下，文字与图形保持可读。
 * 嵌入后跑一遍 checkSvg 确认未引入越界等问题；契约不允许的 href 由调用方保证为 data:。
 */
export function embedImageIntoSvg(
  svg: string,
  dataUrl: string,
  opts: {
    attribution?: string;
    scrimColor?: string;
    scrimOpacity?: number;
  } = {},
): string {
  const rootMatch = svg.match(/^(\s*<svg\b[^>]*>)/i);
  if (!rootMatch) return svg;
  const scrimColor = opts.scrimColor ?? "#000000";
  const scrimOpacity = opts.scrimOpacity ?? 0.45;
  const { w, h } = canvasSizeOf(svg);
  let layer =
    `<image href="${escapeAttr(dataUrl)}" x="0" y="0" width="${w}" height="${h}" ` +
    `preserveAspectRatio="xMidYMid slice" ${EMBED_MARK}/>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${scrimColor}" fill-opacity="${scrimOpacity}" ${EMBED_MARK}/>`;
  if (opts.attribution?.trim()) {
    // 署名上屏（参照 PPT Master：需署名许可的图片在页面角落自动加小字）
    layer +=
      `<text x="${w - 16}" y="${h - 10}" text-anchor="end" font-size="11" ` +
      `fill="#FFFFFF" fill-opacity="0.8" ${EMBED_MARK}>${escapeAttr(`© ${opts.attribution.trim()}`)}</text>`;
  }
  const root = rootMatch[1];
  const body = svg.slice(root.length);
  // 新层插在最前（位于全部内容之下），并移除旧的嵌入层（替换语义）
  return root + layer + stripEmbeddedLayers(body);
}

/** 嵌入后校验：返回 error 级问题（供调用方决定是否回滚） */
export function validateEmbeddedSvg(svg: string, specLock: SpecLock): string[] {
  return checkSvg(svg, specLock)
    .filter((i) => i.severity === "error")
    .map((i) => i.message);
}
