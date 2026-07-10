import { create } from "zustand";
import type { Theme } from "@/types/theme";
import { setCustomThemes, CUSTOM_THEME_PREFIX, BUILTIN_THEMES } from "@/themes";
import {
  listCustomThemes,
  saveCustomTheme,
  deleteCustomTheme as deleteThemeFromStorage,
} from "@/services/storage";
import { cloneThemeFrom } from "@/themes";

export function generateCustomThemeId(): string {
  return `${CUSTOM_THEME_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface CustomThemeStore {
  themes: Theme[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (theme: Theme) => Promise<void>;
  remove: (id: string) => Promise<void>;
  create: (name: string, base?: Theme) => Promise<Theme>;
}

export const useCustomThemeStore = create<CustomThemeStore>((set, get) => ({
  themes: [],
  loaded: false,

  load: async () => {
    try {
      const themes = await listCustomThemes();
      setCustomThemes(themes);
      set({ themes, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (theme) => {
    await saveCustomTheme(theme);
    const themes = await listCustomThemes();
    setCustomThemes(themes);
    set({ themes });
  },

  remove: async (id) => {
    await deleteThemeFromStorage(id);
    const themes = await listCustomThemes();
    setCustomThemes(themes);
    set({ themes });
  },

  create: async (name, base) => {
    const source = base ?? BUILTIN_THEMES[0]!;
    const theme = cloneThemeFrom(source, generateCustomThemeId(), name);
    await get().save(theme);
    return theme;
  },
}));
