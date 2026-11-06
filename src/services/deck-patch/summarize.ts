import type { DeckPatch, AppliedPatchSummary } from "./types";
import { DESTRUCTIVE_OPS } from "./types";
import { t } from "@/services/i18n";

export interface PatchSummary {
  title: string;
  details: string[];
  destructive: boolean;
  changes: {
    inserts: number;
    deletes: number;
    moves: number;
    updates: number;
    merges: number;
    splits: number;
  };
}

export function summarizePatches(patches: DeckPatch[]): PatchSummary {
  const details: string[] = [];
  let destructive = false;
  const changes = {
    inserts: 0,
    deletes: 0,
    moves: 0,
    updates: 0,
    merges: 0,
    splits: 0,
  };

  for (const patch of patches) {
    if (DESTRUCTIVE_OPS.has(patch.op)) destructive = true;

    switch (patch.op) {
      case "set_deck_title":
        details.push(t("patch.setTitle", { title: patch.title }));
        break;
      case "insert_slide":
        details.push(
          t("patch.insertSlide", {
            title: patch.slide.title,
            position: patch.index + 1,
          }),
        );
        changes.inserts++;
        break;
      case "delete_slide":
        details.push(t("patch.deleteSlide"));
        changes.deletes++;
        break;
      case "move_slide":
        details.push(t("patch.moveSlide", { position: patch.toIndex + 1 }));
        changes.moves++;
        break;
      case "update_slide":
        details.push(t("patch.updateSlide"));
        changes.updates++;
        break;
      case "replace_slide":
        details.push(t("patch.replaceSlide", { title: patch.slide.title }));
        changes.updates++;
        break;
      case "split_slide":
        details.push(t("patch.splitSlide", { count: patch.slides.length }));
        changes.splits++;
        break;
      case "merge_slides":
        details.push(
          t("patch.mergeSlides", {
            count: patch.slideIds.length,
            title: patch.slide.title,
          }),
        );
        changes.merges++;
        break;
    }
  }

  const summaryParts: string[] = [];
  if (changes.inserts > 0)
    summaryParts.push(t("patch.changesInsert", { count: changes.inserts }));
  if (changes.deletes > 0)
    summaryParts.push(t("patch.changesDelete", { count: changes.deletes }));
  if (changes.moves > 0)
    summaryParts.push(t("patch.changesMove", { count: changes.moves }));
  if (changes.updates > 0)
    summaryParts.push(t("patch.changesUpdate", { count: changes.updates }));
  if (changes.splits > 0)
    summaryParts.push(t("patch.changesSplit", { count: changes.splits }));
  if (changes.merges > 0)
    summaryParts.push(t("patch.changesMerge", { count: changes.merges }));

  const title =
    summaryParts.length > 0
      ? summaryParts.join("，")
      : t("patch.operationsCount", { count: patches.length });

  return { title, details, destructive, changes };
}

export function summarizeAppliedPatches(
  applied: AppliedPatchSummary[],
): string {
  if (applied.length === 0) return t("patch.noChanges");
  return applied.map((a) => `- ${a.description}`).join("\n");
}
