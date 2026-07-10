import type {
  SlideLayout,
  SlideContentItem,
  ChartSpec,
  ImageSpec,
  Slide,
  Deck,
} from "@/types/deck";

export type DeckPatch =
  | { op: "set_deck_title"; title: string }
  | { op: "insert_slide"; index: number; slide: SlideDraft }
  | { op: "delete_slide"; slideId: string }
  | { op: "move_slide"; slideId: string; toIndex: number }
  | { op: "update_slide"; slideId: string; patch: SlidePatch }
  | { op: "replace_slide"; slideId: string; slide: SlideDraft }
  | { op: "split_slide"; slideId: string; slides: SlideDraft[] }
  | { op: "merge_slides"; slideIds: string[]; slide: SlideDraft };

export interface BulletDraft {
  text: string;
  level: 0 | 1 | 2;
  children?: BulletDraft[];
}

export interface SlideDraft {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: BulletDraft[];
  items?: Omit<SlideContentItem, "id">[];
  chart?: ChartSpec;
  image?: ImageSpec;
  notes?: string;
}

export type SlidePatch = Partial<
  Omit<Slide, "id" | "bullets" | "items" | "elements">
> & {
  bullets?: BulletDraft[];
  items?: Omit<SlideContentItem, "id">[];
};

export interface AppliedPatchSummary {
  op: DeckPatch["op"];
  slideId?: string;
  title: string;
  description: string;
}

export type PatchWarningCode =
  | "slide_not_found"
  | "index_out_of_range"
  | "layout_content_mismatch"
  | "destructive_operation"
  | "empty_patch";

export interface PatchWarning {
  code: PatchWarningCode;
  message: string;
  patchIndex: number;
}

export interface ApplyDeckPatchesResult {
  deck: Deck;
  applied: AppliedPatchSummary[];
  warnings: PatchWarning[];
}

export const DESTRUCTIVE_OPS = new Set<DeckPatch["op"]>([
  "delete_slide",
  "replace_slide",
  "merge_slides",
]);
