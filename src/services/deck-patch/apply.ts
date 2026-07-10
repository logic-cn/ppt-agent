import { nanoid } from "nanoid";
import type { Deck, Slide } from "@/types/deck";
import type {
  DeckPatch,
  SlideDraft,
  ApplyDeckPatchesResult,
  AppliedPatchSummary,
  PatchWarning,
} from "./types";
import { DESTRUCTIVE_OPS } from "./types";

function mapBulletDraft(
  b: import("./types").BulletDraft,
): import("@/types/deck").BulletNode {
  return {
    id: nanoid(),
    text: b.text,
    level: b.level,
    children: b.children?.map(mapBulletDraft),
  };
}

function draftToSlide(draft: SlideDraft): Slide {
  return {
    id: nanoid(),
    layout: draft.layout,
    title: draft.title,
    subtitle: draft.subtitle,
    body: draft.body,
    bullets: draft.bullets?.map(mapBulletDraft),
    items: draft.items?.map((item) => ({
      id: nanoid(),
      title: item.title,
      bullets: item.bullets,
      body: item.body,
    })),
    chart: draft.chart,
    image: draft.image,
    notes: draft.notes,
  };
}

function findSlideIndex(slides: Slide[], slideId: string): number {
  return slides.findIndex((s) => s.id === slideId);
}

export function applyDeckPatches(
  deck: Deck,
  patches: DeckPatch[],
): ApplyDeckPatchesResult {
  const applied: AppliedPatchSummary[] = [];
  const warnings: PatchWarning[] = [];
  let working = structuredClone(deck);

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];

    if (DESTRUCTIVE_OPS.has(patch.op)) {
      warnings.push({
        code: "destructive_operation",
        message: `Patch #${i + 1} (${patch.op}) 是高风险操作，需要用户确认`,
        patchIndex: i,
      });
    }

    switch (patch.op) {
      case "set_deck_title": {
        working = { ...working, title: patch.title };
        applied.push({
          op: "set_deck_title",
          title: "修改标题",
          description: `将标题改为「${patch.title}」`,
        });
        break;
      }

      case "insert_slide": {
        const slide = draftToSlide(patch.slide);
        let index = patch.index;
        if (index < 0) index = 0;
        if (index > working.slides.length) {
          index = working.slides.length;
          warnings.push({
            code: "index_out_of_range",
            message: `Patch #${i + 1} index 超出范围，已追加到末尾`,
            patchIndex: i,
          });
        }
        const slides = [...working.slides];
        slides.splice(index, 0, slide);
        working = { ...working, slides };
        applied.push({
          op: "insert_slide",
          slideId: slide.id,
          title: slide.title,
          description: `在第 ${index + 1} 页后插入「${slide.title}」`,
        });
        break;
      }

      case "delete_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          warnings.push({
            code: "slide_not_found",
            message: `Patch #${i + 1}: 未找到 slideId「${patch.slideId}」`,
            patchIndex: i,
          });
          continue;
        }
        const title = working.slides[idx].title;
        working = {
          ...working,
          slides: working.slides.filter((s) => s.id !== patch.slideId),
        };
        applied.push({
          op: "delete_slide",
          slideId: patch.slideId,
          title: "删除页面",
          description: `删除第 ${idx + 1} 页「${title}」`,
        });
        break;
      }

      case "move_slide": {
        const fromIdx = findSlideIndex(working.slides, patch.slideId);
        if (fromIdx === -1) {
          warnings.push({
            code: "slide_not_found",
            message: `Patch #${i + 1}: 未找到 slideId「${patch.slideId}」`,
            patchIndex: i,
          });
          continue;
        }
        const slides = [...working.slides];
        const [moved] = slides.splice(fromIdx, 1);
        let toIndex = patch.toIndex;
        if (toIndex < 0) toIndex = 0;
        if (toIndex > slides.length) toIndex = slides.length;
        slides.splice(toIndex, 0, moved);
        working = { ...working, slides };
        applied.push({
          op: "move_slide",
          slideId: patch.slideId,
          title: moved.title,
          description: `将第 ${fromIdx + 1} 页「${moved.title}」移到第 ${toIndex + 1} 页`,
        });
        break;
      }

      case "update_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          warnings.push({
            code: "slide_not_found",
            message: `Patch #${i + 1}: 未找到 slideId「${patch.slideId}」`,
            patchIndex: i,
          });
          continue;
        }
        const slides = [...working.slides];
        const p = patch.patch;
        slides[idx] = {
          ...slides[idx],
          ...p,
          bullets: p.bullets
            ? p.bullets.map(mapBulletDraft)
            : slides[idx].bullets,
          items: p.items
            ? p.items.map((item) => ({ ...item, id: nanoid() }))
            : slides[idx].items,
        };
        working = { ...working, slides };
        applied.push({
          op: "update_slide",
          slideId: patch.slideId,
          title: slides[idx].title,
          description: `修改了第 ${idx + 1} 页「${slides[idx].title}」`,
        });
        break;
      }

      case "replace_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          warnings.push({
            code: "slide_not_found",
            message: `Patch #${i + 1}: 未找到 slideId「${patch.slideId}」`,
            patchIndex: i,
          });
          continue;
        }
        const slides = [...working.slides];
        slides[idx] = draftToSlide(patch.slide);
        working = { ...working, slides };
        applied.push({
          op: "replace_slide",
          slideId: patch.slideId,
          title: patch.slide.title,
          description: `替换第 ${idx + 1} 页为「${patch.slide.title}」`,
        });
        break;
      }

      case "split_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          warnings.push({
            code: "slide_not_found",
            message: `Patch #${i + 1}: 未找到 slideId「${patch.slideId}」`,
            patchIndex: i,
          });
          continue;
        }
        const newSlides = patch.slides.map(draftToSlide);
        const slides = [...working.slides];
        slides.splice(idx, 1, ...newSlides);
        working = { ...working, slides };
        applied.push({
          op: "split_slide",
          slideId: patch.slideId,
          title: "拆分页面",
          description: `将第 ${idx + 1} 页拆分为 ${newSlides.length} 页`,
        });
        break;
      }

      case "merge_slides": {
        const indices = patch.slideIds
          .map((id) => findSlideIndex(working.slides, id))
          .filter((i) => i !== -1)
          .sort((a, b) => b - a);
        if (indices.length < 2) {
          warnings.push({
            code: "slide_not_found",
            message: `Patch #${i + 1}: 合并操作需要至少 2 个有效 slideId`,
            patchIndex: i,
          });
          continue;
        }
        const slides = [...working.slides];
        for (const idx of indices) {
          slides.splice(idx, 1);
        }
        slides.splice(
          indices[indices.length - 1],
          0,
          draftToSlide(patch.slide),
        );
        working = { ...working, slides };
        applied.push({
          op: "merge_slides",
          title: "合并页面",
          description: `合并 ${patch.slideIds.length} 页为「${patch.slide.title}」`,
        });
        break;
      }
    }
  }

  working.updatedAt = Date.now();
  return { deck: working, applied, warnings };
}

export function dryRunDeckPatches(
  deck: Deck,
  patches: DeckPatch[],
): { applied: AppliedPatchSummary[]; warnings: PatchWarning[] } {
  const result = applyDeckPatches(deck, patches);
  return { applied: result.applied, warnings: result.warnings };
}
