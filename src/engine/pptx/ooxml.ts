/**
 * PPTX OOXML 后处理（D1，参照 PPT Master pptx_transitions.py / pptx_animations.py）：
 * PptxGenJS 不暴露转场/动画 API，导出后用 JSZip 打开包，
 * 向每页 slideN.xml 注入 `<p:transition>` 与 `<p:timing>`（入场淡入）。
 * 注入点：p:sld 子元素契约顺序 cSld → clrMapOvr → transition → timing，
 * 两者都插在 </p:sld> 之前且 transition 在 timing 之前。
 */

import JSZip from "jszip";

export type TransitionStyle = "none" | "fade" | "push" | "wipe" | "cut";

export interface EffectsOptions {
  transition?: TransitionStyle;
  /** 逐形状入场淡入（单击推进）；默认关闭 */
  entranceAnimation?: boolean;
  /** 每页自动换片毫秒（旁白场景按音频时长传）；index 对应 slide 序 */
  advanceAfterMs?: (number | undefined)[];
}

const EMU_SLIDE_W = 12192000;
const EMU_SLIDE_H = 6858000;

function transitionXml(style: TransitionStyle, advTm?: number): string {
  const inner =
    style === "push"
      ? '<p:push dir="u"/>'
      : style === "wipe"
        ? '<p:wipe dir="d"/>'
        : style === "cut"
          ? "<p:cut/>"
          : "<p:fade/>";
  const adv =
    advTm && advTm > 0 ? ` advTm="${Math.round(advTm)}" advClick="0"` : "";
  return `<p:transition spd="med"${adv}>${inner}</p:transition>`;
}

/** 从 slide XML 提取可加动画的形状 id：跳过 spTree 根节点与近全幅背景形状 */
export function collectAnimatableShapeIds(
  slideXml: string,
  max = 12,
): number[] {
  const ids: number[] = [];
  const spRe = /<p:sp>[\s\S]*?<\/p:sp>/g;
  let spMatch: RegExpExecArray | null;
  let first = true;
  while ((spMatch = spRe.exec(slideXml)) !== null) {
    const sp = spMatch[0];
    const idMatch = sp.match(/<p:cNvPr\s+id="(\d+)"/);
    if (!idMatch) continue;
    if (first) {
      // spTree 根形状组（第一个 sp 通常是画布级容器）
      first = false;
      continue;
    }
    // 近全幅形状视为背景，不参与入场动画
    const ext = sp.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (
      ext &&
      Number(ext[1]) * Number(ext[2]) > EMU_SLIDE_W * EMU_SLIDE_H * 0.85
    ) {
      continue;
    }
    ids.push(Number(idMatch[1]));
    if (ids.length >= max) break;
  }
  return ids;
}

/** 单形状入场淡入（presetID 10 = Fade，单击推进）的 click par 块 */
function fadeClickPar(shapeId: number, cTnId: number): string {
  return (
    `<p:par><p:cTn id="${cTnId}" fill="hold">` +
    `<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>` +
    `<p:childTnLst><p:par><p:cTn id="${cTnId + 1}" fill="hold">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
    `<p:childTnLst><p:par><p:cTn id="${cTnId + 2}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
    `<p:childTnLst>` +
    `<p:set><p:cBhvr><p:cTn id="${cTnId + 3}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>` +
    `<p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>` +
    `<p:to><p:strVal val="visible"/></p:to></p:set>` +
    `<p:animEffect transition="in" filter="fade"><p:cBhvr>` +
    `<p:cTn id="${cTnId + 4}" dur="500"/>` +
    `<p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl>` +
    `</p:cBhvr></p:animEffect>` +
    `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`
  );
}

function timingXml(shapeIds: number[]): string {
  if (shapeIds.length === 0) return "";
  let id = 3;
  const pars = shapeIds
    .map((shapeId) => {
      const block = fadeClickPar(shapeId, id);
      id += 5;
      return block;
    })
    .join("");
  return (
    `<p:timing><p:tnLst><p:par>` +
    `<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek">` +
    `<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${pars}</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  );
}

/**
 * 打包后注入放映效果：转场（可带自动换片毫秒）+ 对象入场动画。
 * 仅修改 ppt/slides/*.xml，其余部件逐字节保留。
 */
export async function applyEffects(
  blob: Blob,
  opts: EffectsOptions,
): Promise<Blob> {
  const hasTransition = !!opts.transition && opts.transition !== "none";
  const hasAnim = !!opts.entranceAnimation;
  const hasAdvance = !!opts.advanceAfterMs?.some((v) => v && v > 0);
  if (!hasTransition && !hasAnim && !hasAdvance) return blob;

  const zip = await JSZip.loadAsync(blob);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort(
      (a, b) => Number(a.match(/(\d+)/)![1]) - Number(b.match(/(\d+)/)![1]),
    );

  for (let i = 0; i < slideFiles.length; i++) {
    const file = zip.file(slideFiles[i]);
    if (!file) continue;
    let xml = await file.async("string");
    if (xml.includes("</p:sld>")) {
      const advTm = opts.advanceAfterMs?.[i];
      const injections: string[] = [];
      if ((hasTransition || (advTm && advTm > 0)) && opts.transition) {
        injections.push(transitionXml(opts.transition, advTm));
      } else if (advTm && advTm > 0) {
        // 无转场样式但需自动换片：仍注入 transition 载体（fade 0 时长不可行，用 cut 即时切换）
        injections.push(transitionXml("cut", advTm));
      }
      if (hasAnim) {
        injections.push(timingXml(collectAnimatableShapeIds(xml)));
      }
      if (injections.length > 0) {
        xml = xml.replace("</p:sld>", `${injections.join("")}</p:sld>`);
        zip.file(slideFiles[i], xml);
      }
    }
  }

  return zip.generateAsync({
    type: "blob",
    mimeType: (blob as Blob & { type?: string }).type || undefined,
  });
}
