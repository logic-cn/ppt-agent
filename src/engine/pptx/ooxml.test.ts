// OOXML 放映效果注入测试（D1）
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { applyEffects, collectAnimatableShapeIds } from "./ooxml";

const SLIDE_XML =
  `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
  `<p:cSld><p:spTree>` +
  `<p:sp><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr/></p:sp>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Background"/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr></p:sp>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Title"/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="800000" y="400000"/><a:ext cx="6000000" cy="800000"/></a:xfrm></p:spPr></p:sp>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="4" name="Body"/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="800000" y="1400000"/><a:ext cx="5000000" cy="3000000"/></a:xfrm></p:spPr></p:sp>` +
  `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

async function blobWithSlide(xml: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", xml);
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "blob" });
}

async function slideXmlOf(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(blob);
  return zip.file("ppt/slides/slide1.xml")!.async("string");
}

describe("collectAnimatableShapeIds", () => {
  it("跳过 spTree 根与近全幅背景，收集内容形状 id", () => {
    const ids = collectAnimatableShapeIds(SLIDE_XML);
    expect(ids).toEqual([3, 4]);
  });
});

describe("applyEffects", () => {
  it("无任何效果时原样返回", async () => {
    const blob = await blobWithSlide(SLIDE_XML);
    const out = await applyEffects(blob, {});
    expect(out).toBe(blob);
  });

  it("注入转场且位于 </p:sld> 之前", async () => {
    const out = await applyEffects(await blobWithSlide(SLIDE_XML), {
      transition: "fade",
    });
    const xml = await slideXmlOf(out);
    expect(xml).toContain('<p:transition spd="med"><p:fade/></p:transition>');
    expect(xml.indexOf("</p:sld>")).toBeGreaterThan(
      xml.indexOf("<p:transition"),
    );
    expect(xml).not.toContain("<p:timing");
  });

  it("注入逐形状入场淡入 timing（按 id 引用）", async () => {
    const out = await applyEffects(await blobWithSlide(SLIDE_XML), {
      entranceAnimation: true,
    });
    const xml = await slideXmlOf(out);
    expect(xml).toContain("<p:timing><p:tnLst>");
    expect(xml).toContain('nodeType="mainSeq"');
    expect((xml.match(/<p:spTgt spid="3"\/>/g) ?? []).length).toBe(2);
    expect((xml.match(/<p:spTgt spid="4"\/>/g) ?? []).length).toBe(2);
    // 背景（id 2）不参与动画
    expect(xml).not.toContain('spid="2"');
    // 转场缺省不注入
    expect(xml).not.toContain("<p:transition");
  });

  it("advanceAfterMs 注入自动换片；无样式时用 cut 载体", async () => {
    const out = await applyEffects(await blobWithSlide(SLIDE_XML), {
      advanceAfterMs: [5200],
    });
    const xml = await slideXmlOf(out);
    expect(xml).toContain('advTm="5200" advClick="0"');
  });

  it("转场在 timing 之前（OOXML 子元素顺序契约）", async () => {
    const out = await applyEffects(await blobWithSlide(SLIDE_XML), {
      transition: "push",
      entranceAnimation: true,
    });
    const xml = await slideXmlOf(out);
    expect(xml.indexOf("<p:transition")).toBeLessThan(xml.indexOf("<p:timing"));
    expect(xml).toContain('<p:push dir="u"/>');
  });
});
