import { create } from "zustand";
import type {
  AppSettings,
  BuiltinProviderId,
  CustomProviderId,
  LLMProviderConfig,
  LLMProviderId,
} from "@/types/llm";
import type { Lang, ThemeMode } from "@/types/preferences";
import { PROVIDER_PRESETS } from "@/types/llm";
import { loadSettings, saveSettings } from "@/services/storage";
import { getSecretStore, secretKey } from "@/services/secret-store";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: AppSettings | null = null;
let saveInFlight: Promise<void> | null = null;

async function flushSave() {
  if (!pendingSettings) return;
  const toSave = pendingSettings;
  pendingSettings = null;
  saveInFlight = saveSettings(toSave)
    .then((report) => {
      // keychain 写失败必须让用户看见（否则密钥既没进安全存储也没进
      // settings.json，重启后静默消失），不再只留 console.warn
      if (report.keychainError) {
        useSettingsStore.setState({
          secretWarning: report.keychainError,
        });
      }
    })
    .catch(console.error);
  await saveInFlight;
  saveInFlight = null;
}

function debouncedSave(settings: AppSettings) {
  pendingSettings = settings;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushSave();
  }, 300);
}

// 页面关闭前落盘
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (saveTimer) clearTimeout(saveTimer);
    if (pendingSettings) {
      saveSettings(pendingSettings).catch(console.error);
    }
  });
}

function defaultSettings(): AppSettings {
  const providers = {} as AppSettings["providers"];
  (Object.keys(PROVIDER_PRESETS) as BuiltinProviderId[]).forEach((id) => {
    const preset = PROVIDER_PRESETS[id];
    providers[id] = { ...preset, apiKey: "", enabled: false };
  });
  return {
    version: 1,
    activeProvider: "local",
    providers,
    pexelsApiKey: "",
    researchEnabled: false,
    tavilyApiKey: "",
    lang: "zh",
    theme: "system",
  };
}

/** 为存量设置补齐后续新增的内置 provider 预设（不覆盖已有项） */
function mergeBuiltinPresets(settings: AppSettings): AppSettings {
  const providers = { ...settings.providers };
  let changed = false;
  (Object.keys(PROVIDER_PRESETS) as BuiltinProviderId[]).forEach((id) => {
    if (!providers[id]) {
      providers[id] = { ...PROVIDER_PRESETS[id], apiKey: "", enabled: false };
      changed = true;
    }
  });
  return changed ? { ...settings, providers } : settings;
}

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  /** 密钥存储（keychain）写失败提示；用户可见，设置页展示后可关闭 */
  secretWarning: string | null;
  clearSecretWarning: () => void;
  load: () => Promise<void>;
  setActiveProvider: (id: LLMProviderId) => void;
  updateProvider: (
    id: LLMProviderId,
    patch: Partial<LLMProviderConfig>,
  ) => void;
  /** 新增一个自定义提供商，返回其 id */
  addCustomProvider: () => CustomProviderId;
  removeCustomProvider: (id: CustomProviderId) => void;
  setPexelsApiKey: (key: string) => void;
  setResearch: (patch: { enabled?: boolean; apiKey?: string }) => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings(),
  loaded: false,
  secretWarning: null,
  clearSecretWarning: () => set({ secretWarning: null }),

  load: async () => {
    const loaded = await loadSettings();
    const settings = mergeBuiltinPresets(loaded ?? get().settings);
    // 兼容旧版本：activeProvider 指向已不存在的 provider（如被移除的内置项）时回退默认值
    if (!settings.providers[settings.activeProvider]) {
      settings.activeProvider = "local";
    }
    set({ settings, loaded: true });
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
      const oldProvider = s.settings.providers[id];
      const updatedProvider = { ...oldProvider, ...patch };
      const providers = {
        ...s.settings.providers,
        [id]: updatedProvider,
      };

      const settings = { ...s.settings, providers };
      void debouncedSave(settings);
      return { settings };
    });
  },

  addCustomProvider: () => {
    const id = `custom-${crypto.randomUUID()}` as CustomProviderId;
    set((s) => {
      const settings = {
        ...s.settings,
        providers: {
          ...s.settings.providers,
          [id]: {
            id,
            label: "",
            baseUrl: "",
            model: "",
            apiKey: "",
            enabled: false,
          },
        },
      };
      void debouncedSave(settings);
      return { settings };
    });
    return id;
  },

  removeCustomProvider: (id) => {
    set((s) => {
      const providers = { ...s.settings.providers };
      delete providers[id];
      const settings = {
        ...s.settings,
        providers,
        // 删除的正好是激活 provider 时回退到默认的本地模型
        // （DeepSeek 等远程服务通常未配置 Key，回退过去会直接导致生成失败）
        activeProvider:
          s.settings.activeProvider === id
            ? "local"
            : s.settings.activeProvider,
      };
      void debouncedSave(settings);
      return { settings };
    });
    // 密钥存储中的残留一并清除（saveSettings 只清理仍在 map 里的 provider）
    getSecretStore()
      .delete(secretKey("provider", id))
      .catch((e) => console.warn(`清除 ${id} 密钥失败：`, e));
  },

  setResearch: (patch) => {
    set((s) => {
      const settings = {
        ...s.settings,
        researchEnabled: patch.enabled ?? s.settings.researchEnabled,
        tavilyApiKey: patch.apiKey ?? s.settings.tavilyApiKey,
      };
      void debouncedSave(settings);
      return { settings };
    });
  },
  setPexelsApiKey: (key) => {
    set((s) => {
      const settings = { ...s.settings, pexelsApiKey: key };
      void debouncedSave(settings);
      return { settings };
    });
  },

  setLang: (lang) => {
    set((s) => {
      const settings = { ...s.settings, lang };
      void debouncedSave(settings);
      return { settings };
    });
  },

  setTheme: (theme) => {
    set((s) => {
      const settings = { ...s.settings, theme };
      void debouncedSave(settings);
      return { settings };
    });
  },
}));

export function getProviderApiKey(providerId: LLMProviderId): string | null {
  const { settings } = useSettingsStore.getState();
  return settings.providers[providerId]?.apiKey ?? null;
}
