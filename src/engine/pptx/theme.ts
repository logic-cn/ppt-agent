/**
 * PPTX 原生主题后处理（母版与版式原生化）：
 * PptxGenJS 固定输出 Office 默认主题（Calibri + Office 蓝），deck 的字体与
 * 配色只存在于每页形状里——PowerPoint 的「设计」面板、主题色板与新建页
 * 默认样式完全感知不到品牌。导出后用 JSZip 打开包，把 ppt/theme/theme1.xml
 * 的 clrScheme / fontScheme 改写为 SpecLock 的色板与字体（含 CJK ea typeface）。
 *
 * 语义槽位映射（对深浅色板一致）：
 *   lt1(bg1)=background  dk1(tx1)=text  lt2(bg2)=surface  dk2(tx2)=textMuted
 *   accent1/2/3=primary/secondary/accent，hlink/folHlink=primary/secondary。
 * 幻灯片形状均为显式 srgbClr，不受主题替换影响；主题只影响母版占位符、
 * 用户新建形状的默认取色与取字。
 */

import JSZip from "jszip";
import type { SpecLock } from "@/design/spec-lock";
import { ooxmlFontFace } from "../pptx-translator/elements";

const hex = (c: string) => c.replace("#", "").toUpperCase();

export function buildThemeClrSchemeXml(colors: SpecLock["colors"]): string {
  const slots: [string, string][] = [
    ["dk1", colors.text],
    ["lt1", colors.background],
    ["dk2", colors.textMuted],
    ["lt2", colors.surface],
    ["accent1", colors.primary],
    ["accent2", colors.secondary],
    ["accent3", colors.accent],
    ["accent4", colors.surface],
    ["accent5", colors.textMuted],
    ["accent6", colors.text],
    ["hlink", colors.primary],
    ["folHlink", colors.secondary],
  ];
  const body = slots
    .map(([slot, c]) => `<a:${slot}><a:srgbClr val="${hex(c)}"/></a:${slot}>`)
    .join("");
  return `<a:clrScheme name="PPT Agent">${body}</a:clrScheme>`;
}

export function buildThemeFontSchemeXml(fonts: SpecLock["fonts"]): string {
  const title = ooxmlFontFace(fonts.title);
  const body = ooxmlFontFace(fonts.body);
  const family = (t: string) =>
    `<a:latin typeface="${t}"/><a:ea typeface="${t}"/><a:cs typeface="${t}"/>`;
  return (
    `<a:fontScheme name="PPT Agent">` +
    `<a:majorFont>${family(title)}</a:majorFont>` +
    `<a:minorFont>${family(body)}</a:minorFont>` +
    `</a:fontScheme>`
  );
}

/**
 * 改写包内 theme1.xml 的配色/字体方案为 SpecLock 设计契约。
 * 其余部件逐字节保留；包内无 theme1.xml 或结构异常时原样返回（不阻断导出）。
 */
export async function applyNativeTheme(
  blob: Blob,
  specLock: SpecLock,
): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob);
  const file = zip.file("ppt/theme/theme1.xml");
  if (!file) return blob;
  const xml = await file.async("string");
  if (!/<a:clrScheme[\s\S]*?<\/a:clrScheme>/.test(xml)) return blob;
  if (!/<a:fontScheme[\s\S]*?<\/a:fontScheme>/.test(xml)) return blob;
  const patched = xml
    .replace(
      /<a:clrScheme[\s\S]*?<\/a:clrScheme>/,
      buildThemeClrSchemeXml(specLock.colors),
    )
    .replace(
      /<a:fontScheme[\s\S]*?<\/a:fontScheme>/,
      buildThemeFontSchemeXml(specLock.fonts),
    );
  zip.file("ppt/theme/theme1.xml", patched);
  return zip.generateAsync({
    type: "blob",
    mimeType: (blob as Blob & { type?: string }).type || undefined,
  });
}
