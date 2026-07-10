import type { DeckPatch, AppliedPatchSummary } from "./types";
import { DESTRUCTIVE_OPS } from "./types";

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
        details.push(`修改标题为「${patch.title}」`);
        break;
      case "insert_slide":
        details.push(
          `插入新页「${patch.slide.title}」（位置: ${patch.index + 1}）`,
        );
        changes.inserts++;
        break;
      case "delete_slide":
        details.push(`删除页面`);
        changes.deletes++;
        break;
      case "move_slide":
        details.push(`移动页面到第 ${patch.toIndex + 1} 位`);
        changes.moves++;
        break;
      case "update_slide":
        details.push(`修改页面`);
        changes.updates++;
        break;
      case "replace_slide":
        details.push(`替换页面为「${patch.slide.title}」`);
        changes.updates++;
        break;
      case "split_slide":
        details.push(`拆分为 ${patch.slides.length} 页`);
        changes.splits++;
        break;
      case "merge_slides":
        details.push(
          `合并 ${patch.slideIds.length} 页为「${patch.slide.title}」`,
        );
        changes.merges++;
        break;
    }
  }

  const summaryParts: string[] = [];
  if (changes.inserts > 0) summaryParts.push(`新增 ${changes.inserts} 页`);
  if (changes.deletes > 0) summaryParts.push(`删除 ${changes.deletes} 页`);
  if (changes.moves > 0) summaryParts.push(`移动 ${changes.moves} 页`);
  if (changes.updates > 0) summaryParts.push(`修改 ${changes.updates} 页`);
  if (changes.splits > 0) summaryParts.push(`拆分 ${changes.splits} 处`);
  if (changes.merges > 0) summaryParts.push(`合并 ${changes.merges} 处`);

  const title =
    summaryParts.length > 0
      ? summaryParts.join("，")
      : `${patches.length} 个操作`;

  return { title, details, destructive, changes };
}

export function summarizeAppliedPatches(
  applied: AppliedPatchSummary[],
): string {
  if (applied.length === 0) return "没有修改。";
  return applied.map((a) => `- ${a.description}`).join("\n");
}
