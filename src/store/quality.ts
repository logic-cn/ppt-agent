import { create } from "zustand";
import type { DeckQualityReport } from "@/services/quality";

interface QualityStore {
  report: DeckQualityReport | null;
  /** 待应用的质量规则（来自模板），下一轮质量检查消费后清空 */
  pendingRules: string[] | null;
  setReport: (report: DeckQualityReport | null) => void;
  setPendingRules: (rules: string[] | null) => void;
  clearPendingRules: () => void;
  clear: () => void;
}

export const useQualityStore = create<QualityStore>((set) => ({
  report: null,
  pendingRules: null,
  setReport: (report) => set({ report }),
  setPendingRules: (rules) => set({ pendingRules: rules }),
  clearPendingRules: () => set({ pendingRules: null }),
  clear: () => set({ report: null, pendingRules: null }),
}));
