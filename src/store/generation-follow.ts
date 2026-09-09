/**
 * 生成跟随（E3）：主题生成期间，ChatPanel 上报正在生成的页索引，
 * 编辑器预览自动跟随切页（对应 PPT Master live preview 的 --live 行为）。
 */

import { create } from "zustand";

interface GenerationFollowState {
  /** 正在生成的页索引；null 表示不在生成中 */
  generatingIndex: number | null;
  setGeneratingIndex: (index: number | null) => void;
}

export const useGenerationFollowStore = create<GenerationFollowState>(
  (set) => ({
    generatingIndex: null,
    setGeneratingIndex: (index) => set({ generatingIndex: index }),
  }),
);
