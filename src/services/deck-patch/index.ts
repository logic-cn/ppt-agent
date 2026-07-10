export type {
  DeckPatch,
  SlideDraft,
  SlidePatch,
  AppliedPatchSummary,
  PatchWarning,
  PatchWarningCode,
  ApplyDeckPatchesResult,
} from "./types";
export { DESTRUCTIVE_OPS } from "./types";
export { deckPatchSchema, deckPatchesResponseSchema } from "./schema";
export { applyDeckPatches, dryRunDeckPatches } from "./apply";
export { summarizePatches, summarizeAppliedPatches } from "./summarize";
export type { PatchSummary } from "./summarize";
export { generateDeckPatches, buildDeckContextSummary } from "./ai";
export type { DeckContextSummary } from "./ai";
