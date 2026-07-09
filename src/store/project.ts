import { create } from "zustand";
import type { Deck } from "@/types";
import { listDecks } from "@/services/storage";

interface ProjectStore {
  recent: Deck[];
  loading: boolean;
  loadRecent: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  recent: [],
  loading: false,

  loadRecent: async () => {
    set({ loading: true });
    const recent = await listDecks();
    set({ recent, loading: false });
  },
}));
