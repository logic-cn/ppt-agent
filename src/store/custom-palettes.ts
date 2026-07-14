import { create } from "zustand";
import type { Palette, ThemeColors } from "@/design/palettes";
import { setCustomPalettes } from "@/design/palettes";
import {
  listCustomPalettes,
  saveCustomPalette,
  deleteCustomPalette,
} from "@/services/storage";

export function generateCustomPaletteId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface CustomPaletteStore {
  palettes: Palette[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (p: Palette) => Promise<void>;
  remove: (id: string) => Promise<void>;
  create: (name: string, colors: ThemeColors) => Promise<Palette>;
}

export const useCustomPalettes = create<CustomPaletteStore>((set, get) => ({
  palettes: [],
  loaded: false,
  load: async () => {
    try {
      const palettes = await listCustomPalettes();
      setCustomPalettes(palettes);
      set({ palettes, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save: async (p) => {
    await saveCustomPalette(p);
    const palettes = await listCustomPalettes();
    setCustomPalettes(palettes);
    set({ palettes });
  },
  remove: async (id) => {
    await deleteCustomPalette(id);
    const palettes = await listCustomPalettes();
    setCustomPalettes(palettes);
    set({ palettes });
  },
  create: async (name, colors) => {
    const p: Palette = { id: generateCustomPaletteId(), name, colors };
    await get().save(p);
    return p;
  },
}));
