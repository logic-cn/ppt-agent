import { create } from "zustand";
import type {
  AppSettings,
  LLMProviderConfig,
  LLMProviderId,
} from "@/types/llm";
import { PROVIDER_PRESETS } from "@/types/llm";
import { loadSettings, saveSettings } from "@/services/storage";
import {
  getSecretStore,
  isUsingSecureSecretStorage,
  makeProviderKey,
  makeImageKey,
} from "@/services/secret-store";
import { useToastStore } from "@/store/toast";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: AppSettings | null = null;
let saveInFlight: Promise<void> | null = null;

// SecretStore 为异步单例，复用同一 Promise 避免重复初始化
let storePromise: ReturnType<typeof getSecretStore> | null = null;
function resolveStore() {
  if (!storePromise) storePromise = getSecretStore();
  return storePromise;
}

async function flushSave() {
  if (!pendingSettings) return;
  const toSave = pendingSettings;
  pendingSettings = null;
  saveInFlight = saveSettings(toSave).catch(console.error);
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
  secretMigrated: boolean;
  secureSecretStorage: boolean;
  load: () => Promise<void>;
  setActiveProvider: (id: LLMProviderId) => void;
  updateProvider: (
    id: LLMProviderId,
    patch: Partial<LLMProviderConfig>,
  ) => void;
  setImageEnabled: (enabled: boolean) => void;
  setImageProvider: (cfg: LLMProviderConfig) => void;
}

async function migrateSecrets(settings: AppSettings): Promise<AppSettings> {
  const secretStore = await resolveStore();
  let modified = false;

  for (const [id, provider] of Object.entries(settings.providers)) {
    const key = makeProviderKey(id);
    const existing = await secretStore.getSecret(key);
    if (!existing && provider.apiKey) {
      await secretStore.setSecret(key, provider.apiKey);
      provider.apiKey = "";
      modified = true;
    }
  }

  if (settings.imageProvider?.apiKey) {
    const imgKey = makeImageKey();
    const existing = await secretStore.getSecret(imgKey);
    if (!existing) {
      await secretStore.setSecret(imgKey, settings.imageProvider.apiKey);
      settings.imageProvider.apiKey = "";
      modified = true;
    }
  }

  return modified
    ? { ...settings, providers: { ...settings.providers } }
    : settings;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings(),
  loaded: false,
  secretMigrated: false,
  secureSecretStorage: false,

  load: async () => {
    const saved = await loadSettings();
    let settings = saved ?? get().settings;

    // 迁移 API Key 到安全存储
    const migrated = await migrateSecrets(settings);
    if (migrated !== settings) {
      settings = migrated;
      await saveSettings(settings);
      set({ secretMigrated: true });
    }

    const secure = isUsingSecureSecretStorage();
    set({ settings, loaded: true, secureSecretStorage: secure });

    // 降级到本地明文存储时明确提示用户
    if (!secure) {
      useToastStore.getState().add({
        type: "warning",
        title: "密钥以本地明文保存",
        message:
          "未检测到系统密钥库（Keychain），API Key 已保存到本地存储，建议仅在本机使用。",
      });
    }
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

      if (patch.apiKey && patch.apiKey !== oldProvider?.apiKey) {
        const apiKey = patch.apiKey;
        void resolveStore().then((secretStore) =>
          secretStore.setSecret(makeProviderKey(id), apiKey),
        );
      }

      const settings = { ...s.settings, providers };
      // 安全存储已有 apiKey，持久化时剥离以免明文落盘
      const forStorage = {
        ...settings,
        providers: {
          ...providers,
          [id]: { ...updatedProvider, apiKey: "" },
        },
      };
      void debouncedSave(forStorage);
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
      if (cfg.apiKey) {
        void resolveStore().then((secretStore) =>
          secretStore.setSecret(makeImageKey(), cfg.apiKey),
        );
      }
      const settings = { ...s.settings, imageProvider: cfg };
      // 安全存储已有 apiKey，持久化时剥离
      const forStorage = {
        ...settings,
        imageProvider: cfg.apiKey ? { ...cfg, apiKey: "" } : cfg,
      };
      void debouncedSave(forStorage);
      return { settings };
    });
  },
}));

// 工具函数：从安全存储中获取 API Key（供 services 使用）
export async function getDecryptedApiKey(
  providerId: LLMProviderId,
): Promise<string | null> {
  const { settings } = useSettingsStore.getState();
  const provider = settings.providers[providerId];
  if (!provider) return null;

  // 先从安全存储读取
  const secretStore = await resolveStore();
  const fromSecret = await secretStore.getSecret(makeProviderKey(providerId));
  if (fromSecret) return fromSecret;

  // 降级到 settings
  return provider.apiKey || null;
}
