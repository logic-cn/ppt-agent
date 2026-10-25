// PPTX 原生主题后处理测试（母版与版式原生化）
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  applyNativeTheme,
  buildThemeClrSchemeXml,
  buildThemeFontSchemeXml,
} from "./theme";
import { svgToPptx } from "@/engine/pptx-translator";
import { ooxmlFontFace } from "@/engine/pptx-translator/elements";
import { DEFAULT_DESIGN } from "@/types/design";
import { buildSpecLock } from "@/design/spec-lock";
import type { Slide } from "@/types/deck";
import type { SpecLock } from "@/design/spec-lock";

const SPEC: SpecLock = buildSpecLock(DEFAULT_DESIGN);
const TITLE_FACE = ooxmlFontFace(SPEC.fonts.title);
const BODY_FACE = ooxmlFontFace(SPEC.fonts.body);

/** pptxgenjs 形态的 Office 默认主题（改写目标 fixture） */
const OFFICE_THEME_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">` +
  `<a:objectDefaults/><a:themeElements>` +
  `<a:clrScheme name="Office">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
  `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="44546A"/></a:dk2>` +
  `<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="4472C4"/></a:accent1>` +
  `<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>` +
  `<a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>` +
  `<a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="0563C1"/></a:hlink>` +
  `<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>` +
  `</a:clrScheme>` +
  `<a:fontScheme name="Office">` +
  `<a:majorFont><a:latin typeface="Calibri Light" panose="020F0302020204030204"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="Yu Gothic Light"/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="Calibri" panose="020F0502020204030204"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="Yu Gothic"/></a:minorFont>` +
  `</a:fontScheme>` +
  `</a:themeElements></a:theme>`;

async function blobWithTheme(xml: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("ppt/theme/theme1.xml", xml);
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "blob" });
}

async function themeXmlOf(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(blob);
  return zip.file("ppt/theme/theme1.xml")!.async("string");
}

describe("主题方案生成器", () => {
  it("clrScheme：语义槽位映射色板（lt1=背景 dk1=文字 accent1=primary）", () => {
    const xml = buildThemeClrSchemeXml(SPEC.colors);
    const c = SPEC.colors;
    expect(xml).toContain(
      `<a:dk1><a:srgbClr val="${c.text.replace("#", "").toUpperCase()}"/></a:dk1>`,
    );
    expect(xml).toContain(
      `<a:lt1><a:srgbClr val="${c.background.replace("#", "").toUpperCase()}"/></a:lt1>`,
    );
    expect(xml).toContain(
      `<a:accent1><a:srgbClr val="${c.primary.replace("#", "").toUpperCase()}"/></a:accent1>`,
    );
    expect(xml).toContain(
      `<a:accent3><a:srgbClr val="${c.accent.replace("#", "").toUpperCase()}"/></a:accent3>`,
    );
    expect(xml).toContain('name="PPT Agent"');
  });

  it("fontScheme：majorFont/minorFont 均带 CJK ea typeface（字体栈归一为单一字体名）", () => {
    const xml = buildThemeFontSchemeXml(SPEC.fonts);
    // SpecLock 的字体值是 CSS 栈（'Source Han Sans CN', sans-serif），
    // OOXML typeface 必须是归一后的单一字体名
    expect(TITLE_FACE).not.toMatch(/['",]/);
    expect(xml).toContain(`<a:ea typeface="${TITLE_FACE}"/>`);
    expect(
      xml.match(new RegExp(`<a:ea typeface="${TITLE_FACE}"/>`, "g"))!.length,
    ).toBe(2);
    expect(xml).toContain(`<a:latin typeface="${BODY_FACE}"/>`);
    expect(xml).toContain('name="PPT Agent"');
  });
});

describe("applyNativeTheme", () => {
  it("改写 Office 默认主题为 SpecLock 字体与配色", async () => {
    const out = await applyNativeTheme(
      await blobWithTheme(OFFICE_THEME_XML),
      SPEC,
    );
    const xml = await themeXmlOf(out);
    expect(xml).toContain('name="PPT Agent"');
    expect(xml).not.toContain("Calibri");
    expect(xml).not.toContain("4472C4");
    expect(xml).toContain(`<a:ea typeface="${TITLE_FACE}"/>`);
    expect(xml).toContain(SPEC.colors.primary.replace("#", "").toUpperCase());
  });

  it("包内无 theme1.xml 或结构异常时原样返回", async () => {
    const noTheme = new JSZip();
    noTheme.file("[Content_Types].xml", "<Types/>");
    const blob = await noTheme.generateAsync({ type: "blob" });
    expect(await applyNativeTheme(blob, SPEC)).toBe(blob);

    const malformed = await blobWithTheme(
      "<a:theme><a:themeElements/></a:theme>",
    );
    expect(await applyNativeTheme(malformed, SPEC)).toBe(malformed);
  });
});

describe("导出包件结构（svgToPptx 全链路）", () => {
  const SLIDE = (layout: Slide["layout"]): Slide => ({
    id: "s",
    layout,
    title: "t",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><text x="10" y="10" font-size="12" fill="#FFFFFF">x</text></svg>`,
  });

  it("theme1.xml 为 SpecLock 原生主题（字体含 ea、配色为色板 token）", async () => {
    const blob = await svgToPptx([SLIDE("content")], DEFAULT_DESIGN);
    const zip = await JSZip.loadAsync(blob);
    const xml = await zip.file("ppt/theme/theme1.xml")!.async("string");
    expect(xml).toContain('name="PPT Agent"');
    expect(xml).toContain(`<a:ea typeface="${TITLE_FACE}"/>`);
    expect(xml).not.toContain("Calibri");
    // 所有 typeface 值都必须是归一的单一字体名（无引号/逗号字体栈）
    for (const m of xml.matchAll(/typeface="([^"]+)"/g)) {
      expect(m[1]!).not.toMatch(/['",]/);
    }
    expect(xml).toContain(SPEC.colors.primary.replace("#", "").toUpperCase());
  });

  it("逐角色 sldLayout 部件存在，slide 按版式挂到对应母版", async () => {
    const blob = await svgToPptx(
      [SLIDE("cover"), SLIDE("section"), SLIDE("content"), SLIDE("closing")],
      DEFAULT_DESIGN,
    );
    const zip = await JSZip.loadAsync(blob);
    const layoutNames = new Set<string>();
    const layoutRels: Record<string, string> = {};
    for (const name of Object.keys(zip.files)) {
      const layoutMatch = name.match(
        /^ppt\/slideLayouts\/(slideLayout\d+)\.xml$/,
      );
      if (layoutMatch) {
        const xml = await zip.file(name)!.async("string");
        const n = xml.match(/name="([^"]+)"/)?.[1] ?? "";
        layoutNames.add(n);
        layoutRels[n] = layoutMatch[1];
      }
    }
    for (const master of [
      "PPT_AGENT_COVER",
      "PPT_AGENT_SECTION",
      "PPT_AGENT_CONTENT",
      "PPT_AGENT_CLOSING",
    ]) {
      expect(layoutNames.has(master), `缺少版式 ${master}`).toBe(true);
    }
    // slide1（cover）的 rels 应指向 PPT_AGENT_COVER 版式
    const rels = await zip
      .file("ppt/slides/_rels/slide1.xml.rels")!
      .async("string");
    const target = rels.match(/slideLayouts\/(slideLayout\d+\.xml)/)?.[1];
    expect(target).toBe(`${layoutRels.PPT_AGENT_COVER}.xml`);
  });
});
