import { create } from "zustand";
import type { Deck } from "@/types/deck";
import { loadDeck, saveDeck, createEmptyDeck } from "@/services/storage";

interface HistoryEntry {
  slides: Deck["slides"];
}

interface DeckStore {
  deck: Deck | null;
  loading: boolean;
  dirty: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

  load: (id: string) => Promise<void>;
  createDeck: (title?: string) => Promise<Deck>;
  setTitle: (title: string) => void;
  setTheme: (themeId: string) => void;
  setSource: (source: Deck["source"]) => void;

  // 幻灯片操作（自动记录历史）
  addSlide: (slide: Deck["slides"][number]) => void;
  updateSlide: (id: string, patch: Partial<Deck["slides"][number]>) => void;
  removeSlide: (id: string) => void;
  moveSlide: (from: number, to: number) => void;
  replaceSlides: (slides: Deck["slides"]) => Promise<void>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;

  persist: () => Promise<void>;
}

function snapshot(deck: Deck | null): HistoryEntry | null {
  if (!deck) return null;
  return { slides: JSON.parse(JSON.stringify(deck.slides)) };
}

export const useDeckStore = create<DeckStore>((set, get) => ({
  deck: null,
  loading: false,
  dirty: false,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  load: async (id) => {
    set({ loading: true });
    const deck = await loadDeck(id);
    if (deck) {
      const bumped = { ...deck, updatedAt: Date.now() };
      await saveDeck(bumped);
      set({ deck: bumped, loading: false, dirty: false, past: [], future: [] });
    } else {
      set({ deck: null, loading: false });
    }
  },

  createDeck: async (title) => {
    const deck = createEmptyDeck(title);
    await saveDeck(deck);
    set({ deck, dirty: false, past: [], future: [] });
    return deck;
  },

  setTitle: (title) => {
    set((s) => ({
      deck: s.deck ? { ...s.deck, title, updatedAt: Date.now() } : null,
      dirty: true,
    }));
  },

  setTheme: (themeId) => {
    set((s) => ({
      deck: s.deck ? { ...s.deck, themeId, updatedAt: Date.now() } : null,
      dirty: true,
    }));
  },

  setSource: (source) => {
    set((s) => ({
      deck: s.deck ? { ...s.deck, source, updatedAt: Date.now() } : null,
      dirty: true,
    }));
  },

  addSlide: (slide) => {
    set((s) => {
      const snap = snapshot(s.deck);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              slides: [...s.deck.slides, slide],
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  updateSlide: (id, patch) => {
    set((s) => {
      const snap = snapshot(s.deck);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              slides: s.deck.slides.map((sl) =>
                sl.id === id ? { ...sl, ...patch } : sl,
              ),
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  removeSlide: (id) => {
    set((s) => {
      const snap = snapshot(s.deck);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              slides: s.deck.slides.filter((sl) => sl.id !== id),
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  moveSlide: (from, to) => {
    set((s) => {
      if (!s.deck) return s;
      const snap = snapshot(s.deck);
      const slides = [...s.deck.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return {
        deck: { ...s.deck, slides, updatedAt: Date.now() },
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  replaceSlides: async (slides) => {
    set((s) => {
      const snap = snapshot(s.deck);
      return {
        deck: s.deck ? { ...s.deck, slides, updatedAt: Date.now() } : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
    await get().persist();
  },

  undo: () => {
    const { past, deck } = get();
    if (past.length === 0 || !deck) return;
    const entry = past[past.length - 1];
    const newPast = past.slice(0, -1);
    set({
      deck: {
        ...deck,
        slides: JSON.parse(JSON.stringify(entry.slides)),
        updatedAt: Date.now(),
      },
      past: newPast,
      future: [
        ...get().future,
        { slides: JSON.parse(JSON.stringify(deck.slides)) },
      ],
      canUndo: newPast.length > 0,
      canRedo: true,
      dirty: true,
    });
  },

  redo: () => {
    const { future, deck } = get();
    if (future.length === 0 || !deck) return;
    const entry = future[future.length - 1];
    const newFuture = future.slice(0, -1);
    set({
      deck: {
        ...deck,
        slides: JSON.parse(JSON.stringify(entry.slides)),
        updatedAt: Date.now(),
      },
      past: [
        ...get().past,
        { slides: JSON.parse(JSON.stringify(deck.slides)) },
      ],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      dirty: true,
    });
  },

  persist: async () => {
    const { deck } = get();
    if (!deck) return;
    await saveDeck(deck);
    set({ dirty: false });
  },
}));
