import { nanoid } from "nanoid";
import type { Deck, Slide } from "@/types/deck";
import { touchesSvgVisual } from "@/types/deck";
import type {
  DeckPatch,
  SlideDraft,
  ApplyDeckPatchesResult,
  AppliedPatchSummary,
  PatchWarning,
} from "./types";
import { DESTRUCTIVE_OPS } from "./types";
import { t } from "@/services/i18n";

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
    metric: draft.metric,
    quote: draft.quote,
    attribution: draft.attribution,
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

  // 原子性：任意 patch 校验失败时，默认不修改原 deck。
  // 这里先收集所有 warning（含致命错误），若出现过致命错误则整体回滚。
  let working = structuredClone(deck);
  let hadFatal = false;

  const failSlideNotFound = (i: number, slideId: string) => {
    hadFatal = true;
    warnings.push({
      code: "slide_not_found",
      message: t("patch.warn.slideNotFound", {
        index: i + 1,
        slideId,
      }),
      patchIndex: i,
      fatal: true,
    });
  };

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];

    if (DESTRUCTIVE_OPS.has(patch.op)) {
      warnings.push({
        code: "destructive_operation",
        message: t("patch.warn.destructive", { index: i + 1, op: patch.op }),
        patchIndex: i,
      });
    }

    switch (patch.op) {
      case "set_deck_title": {
        working = { ...working, title: patch.title };
        applied.push({
          op: "set_deck_title",
          title: t("patch.setTitle", { title: patch.title }),
          description: t("patch.applied.setTitle", { title: patch.title }),
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
            message: t("patch.warn.indexOutOfRange", { index: i + 1 }),
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
          description: t("patch.applied.insertSlide", {
            position: index + 1,
            title: slide.title,
          }),
        });
        break;
      }

      case "delete_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          failSlideNotFound(i, patch.slideId);
          break;
        }
        const title = working.slides[idx].title;
        working = {
          ...working,
          slides: working.slides.filter((s) => s.id !== patch.slideId),
        };
        applied.push({
          op: "delete_slide",
          slideId: patch.slideId,
          title: t("patch.deleteSlide"),
          description: t("patch.applied.deleteSlide", {
            position: idx + 1,
            title,
          }),
        });
        break;
      }

      case "move_slide": {
        const fromIdx = findSlideIndex(working.slides, patch.slideId);
        if (fromIdx === -1) {
          failSlideNotFound(i, patch.slideId);
          break;
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
          description: t("patch.applied.moveSlide", {
            from: fromIdx + 1,
            to: toIndex + 1,
            title: moved.title,
          }),
        });
        break;
      }

      case "update_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          failSlideNotFound(i, patch.slideId);
          break;
        }
        const slides = [...working.slides];
        const p = patch.patch;
        const original = slides[idx];
        const merged: Slide = {
          ...original,
          ...p,
          bullets: p.bullets ? p.bullets.map(mapBulletDraft) : original.bullets,
          items: p.items
            ? p.items.map((item) => ({ ...item, id: nanoid() }))
            : original.items,
        };
        // 编辑了影响 SVG 视觉的结构化字段、且该页已有 SVG → 标记过期
        if (
          original.svg &&
          touchesSvgVisual(p as Record<string, unknown>) &&
          !("svgStale" in p)
        ) {
          merged.svgStale = true;
        }
        slides[idx] = merged;
        working = { ...working, slides };
        applied.push({
          op: "update_slide",
          slideId: patch.slideId,
          title: slides[idx].title,
          description: t("patch.applied.updateSlide", {
            position: idx + 1,
            title: slides[idx].title,
          }),
        });
        break;
      }

      case "replace_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          failSlideNotFound(i, patch.slideId);
          break;
        }
        const slides = [...working.slides];
        slides[idx] = draftToSlide(patch.slide);
        working = { ...working, slides };
        applied.push({
          op: "replace_slide",
          slideId: patch.slideId,
          title: patch.slide.title,
          description: t("patch.applied.replaceSlide", {
            position: idx + 1,
            title: patch.slide.title,
          }),
        });
        break;
      }

      case "split_slide": {
        const idx = findSlideIndex(working.slides, patch.slideId);
        if (idx === -1) {
          failSlideNotFound(i, patch.slideId);
          break;
        }
        const newSlides = patch.slides.map(draftToSlide);
        const slides = [...working.slides];
        slides.splice(idx, 1, ...newSlides);
        working = { ...working, slides };
        applied.push({
          op: "split_slide",
          slideId: patch.slideId,
          title: t("patch.splitSlide", { count: newSlides.length }),
          description: t("patch.applied.splitSlide", {
            position: idx + 1,
            count: newSlides.length,
          }),
        });
        break;
      }

      case "merge_slides": {
        const indices = patch.slideIds
          .map((id) => findSlideIndex(working.slides, id))
          .filter((i) => i !== -1)
          .sort((a, b) => b - a);
        if (indices.length < 2) {
          hadFatal = true;
          warnings.push({
            code: "slide_not_found",
            message: t("patch.warn.mergeNeedsTwo", { index: i + 1 }),
            patchIndex: i,
            fatal: true,
          });
          break;
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
          title: t("patch.mergeSlides", {
            count: patch.slideIds.length,
            title: patch.slide.title,
          }),
          description: t("patch.applied.mergeSlides", {
            count: patch.slideIds.length,
            title: patch.slide.title,
          }),
        });
        break;
      }
    }
  }

  // 原子回滚：出现过致命错误则不应用任何修改，原 deck 原样返回
  if (hadFatal) {
    return { deck, applied: [], warnings };
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
