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

const EMBED_MARK = 'data-embed="image"';
/** 兼容早期网络搜图嵌入层（data-embed="web"） */
const EMBED_MARK_RE = 'data-embed="(?:web|image)"';

/** 移除既有嵌入层（image/遮罩/署名，重复应用时替换而非叠加） */
function stripEmbeddedLayers(svg: string): string {
  return svg
    .replace(new RegExp(`<image\\b[^>]*\\b${EMBED_MARK_RE}[^>]*/>`, "gi"), "")
    .replace(new RegExp(`<rect\\b[^>]*\\b${EMBED_MARK_RE}[^>]*/>`, "gi"), "")
    .replace(
      new RegExp(`<text\\b[^>]*\\b${EMBED_MARK_RE}[^>]*>[^<]*</text>`, "gi"),
      "",
    );
}

/** 从页面 SVG 移除已嵌入的图片层；无嵌入时原样返回 */
export function removeEmbeddedImageFromSvg(svg: string): string {
  return stripEmbeddedLayers(svg);
}

function tagAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) attrs[m[1]] = m[2] ?? m[3] ?? "";
  return attrs;
}

/** 生成页常以一条铺满画布的不透明 rect 作页面底色——底图必须画在它之上 */
function isFullBleedOpaqueRect(
  tag: string,
  canvas: { w: number; h: number },
): boolean {
  const a = tagAttrs(tag);
  if (Number(a.x ?? 0) > 1 || Number(a.y ?? 0) > 1) return false;
  if (Number(a.width ?? 0) < canvas.w - 1) return false;
  if (Number(a.height ?? 0) < canvas.h - 1) return false;
  const fill = (a.fill ?? "").trim().toLowerCase();
  if (fill === "" || fill === "none") return false;
  const opacity = Number(a["fill-opacity"] ?? a.opacity ?? 1);
  return !(Number.isFinite(opacity) && opacity <= 0);
}

/** 跳过前导 defs/style/注释与全幅不透明背景矩形，返回底图插入偏移 */
function findLayerOffset(
  body: string,
  canvas: { w: number; h: number },
): number {
  let offset = 0;
  for (;;) {
    const ws = body.slice(offset).match(/^\s+/);
    if (ws) offset += ws[0].length;
    const m = body
      .slice(offset)
      .match(
        /^(<!--[\s\S]*?-->|<defs\b[\s\S]*?<\/defs>|<style\b[\s\S]*?<\/style>|<rect\b[^>]*>)/,
      );
    if (!m) return offset;
    const tag = m[0];
    if (tag.startsWith("<rect")) {
      if (!isFullBleedOpaqueRect(tag, canvas)) return offset;
      offset += tag.length;
      continue;
    }
    offset += tag.length;
  }
}

/**
 * 在页面 SVG 底层嵌入图片：
 * <image>（preserveAspectRatio slice 铺满画布）+ 底色 45% 遮罩，
 * 两层均带 data-embed 标记——重复嵌入会先移除旧层（替换语义）。
 * 插入点在全幅背景矩形之后、页面内容之前：图片盖住底色但不遮挡文字与图形，
 * 翻译器按文档序绘制，预览与导出一致。
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
  const body = stripEmbeddedLayers(svg.slice(root.length));
  const offset = findLayerOffset(body, { w, h });
  return root + body.slice(0, offset) + layer + body.slice(offset);
}

/** 嵌入后校验：返回 error 级问题（供调用方决定是否回滚） */
export function validateEmbeddedSvg(svg: string, specLock: SpecLock): string[] {
  return checkSvg(svg, specLock)
    .filter((i) => i.severity === "error")
    .map((i) => i.message);
}
