import { create } from "zustand";
import type {
  AppSettings,
  LLMProviderConfig,
  LLMProviderId,
} from "@/types/llm";
import { PROVIDER_PRESETS } from "@/types/llm";
import { loadSettings, saveSettings } from "@/services/storage";

function defaultSettings(): AppSettings {
  const providers = {} as Record<LLMProviderId, LLMProviderConfig>;
  (Object.keys(PROVIDER_PRESETS) as LLMProviderId[]).forEach((id) => {
    const preset = PROVIDER_PRESETS[id];
    providers[id] = { ...preset, apiKey: "", enabled: false };
  });
  return {
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
      void saveSettings(settings);
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
      void saveSettings(settings);
      return { settings };
    });
  },

  setImageEnabled: (enabled) => {
    set((s) => {
      const settings = { ...s.settings, imageEnabled: enabled };
      void saveSettings(settings);
      return { settings };
    });
  },

  setImageProvider: (cfg) => {
    set((s) => {
      const settings = { ...s.settings, imageProvider: cfg };
      void saveSettings(settings);
      return { settings };
    });
  },
}));
