import type { DesignLock } from "../../types/design";
import type { GalleryExample } from "../../types/example";
import { getExamples } from "../../examples";

function score(ex: GalleryExample, d: DesignLock): number {
  let s = 0;
  if (ex.design.mode === d.mode) s += 2;
  if (ex.design.visualStyle === d.visualStyle) s += 1;
  return s;
}

export function selectFewShot(design: DesignLock, max = 2): GalleryExample[] {
  return getExamples()
    .map((e) => ({ e, s: score(e, design) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.e);
}

export function buildFewShotPrompt(examples: GalleryExample[]): string {
  if (examples.length === 0) return "";
  const body = examples
    .map(
      (e) =>
        `示例(${e.design.mode}/${e.design.visualStyle}):\n` +
        JSON.stringify(
          e.slides.map((s) => ({
            layout: s.layout,
            title: s.title,
            bullets: (s.bullets ?? []).length,
          })),
        ),
    )
    .join("\n\n");
  return `以下是同风格的优质结构范例，请参考其章节编排与标题写法（不要照抄内容）：\n${body}`;
}
