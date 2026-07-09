import { create } from "zustand";
import type {
  AppSettings,
  LLMProviderConfig,
  LLMProviderId,
} from "@/types/llm";
import { PROVIDER_PRESETS } from "@/types/llm";
import { loadSettings, saveSettings } from "@/services/storage";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSettings(settings).catch(console.error);
  }, 300);
}

function defaultSettings(): AppSettings {
  const providers = {} as Record<LLMProviderId, LLMProviderConfig>;
  (Object.keys(PROVIDER_PRESETS) as LLMProviderId[]).forEach((id) => {
    const preset = PROVIDER_PRESETS[id];
    providers[id] = { ...preset, apiKey: "", enabled: false };
  });
  return {
    version: 1,
    activeProvider: "openai",
    providers,
    imageEnabled: false,
  };
}

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  setActiveProvider: (id: LLMProviderId) => void;
  updateProvider: (
    id: LLMProviderId,
    patch: Partial<LLMProviderConfig>,
  ) => void;
  setImageEnabled: (enabled: boolean) => void;
  setImageProvider: (cfg: LLMProviderConfig) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings(),
  loaded: false,

  load: async () => {
    const saved = await loadSettings();
    set({
      settings: saved ?? get().settings,
      loaded: true,
    });
  },

  setActiveProvider: (id) => {
    set((s) => {
      const settings = { ...s.settings, activeProvider: id };
      void debouncedSave(settings);
      return { settings };
    });
  },

  updateProvider: (id, patch) => {
    set((s) => {
      const providers = {
        ...s.settings.providers,
        [id]: { ...s.settings.providers[id], ...patch },
      };
      const settings = { ...s.settings, providers };
      void debouncedSave(settings);
      return { settings };
    });
  },

  setImageEnabled: (enabled) => {
    set((s) => {
      const settings = { ...s.settings, imageEnabled: enabled };
      void debouncedSave(settings);
      return { settings };
    });
  },

  setImageProvider: (cfg) => {
    set((s) => {
      const settings = { ...s.settings, imageProvider: cfg };
      void debouncedSave(settings);
      return { settings };
    });
  },
}));
