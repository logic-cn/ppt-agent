import { create } from "zustand";
import type { DeckMeta } from "@/types";
import { listDecks } from "@/services/storage";

interface ProjectStore {
  recent: DeckMeta[];
  loading: boolean;
  loadRecent: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  recent: [],
  loading: false,

  loadRecent: async () => {
    set({ loading: true });
    try {
      const recent = await listDecks();
      set({ recent, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
}));
