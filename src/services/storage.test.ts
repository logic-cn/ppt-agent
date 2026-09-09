import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppSettings } from "@/types/llm";
import { PROVIDER_PRESETS } from "@/types/llm";
import { loadSettings, saveSettings } from "./storage";
import { getSecretStore, resetSecretStore, secretKey } from "./secret-store";

/** 环境内全局 localStorage 实现残缺，注入内存实现 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as unknown as Storage;
}

function makeSettings(apiKey = ""): AppSettings {
  const providers = {} as AppSettings["providers"];
  for (const [id, preset] of Object.entries(PROVIDER_PRESETS)) {
    providers[id as keyof AppSettings["providers"]] = {
      ...preset,
      apiKey,
      enabled: true,
    };
  }
  return {
    version: 1,
    activeProvider: "deepseek",
    providers,
    lang: "zh",
    theme: "system",
  };
}

describe("settings 存储（密钥拆分）", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    resetSecretStore();
  });

  it("saveSettings 落盘的 settings.json 不含 apiKey，密钥进 SecretStore", async () => {
    const s = makeSettings("sk-secret-1");
    await saveSettings(s);

    const raw = localStorage.getItem("ppt-agent-data/settings.json");
    expect(raw).not.toBeNull();
    // 明文密钥绝不落盘
    expect(raw!).not.toContain("sk-secret-1");
    expect(raw!.match(/"apiKey"\s*:\s*"[^"]+"/)).toBeNull();

    const persisted = JSON.parse(raw!) as AppSettings;
    expect(persisted.providers.deepseek.apiKey).toBe("");
    expect(persisted.providers.deepseek.enabled).toBe(true);

    const store = getSecretStore();
    expect(await store.get(secretKey("provider", "deepseek"))).toBe(
      "sk-secret-1",
    );
  });

  it("loadSettings 从 SecretStore 合并回 apiKey", async () => {
    await saveSettings(makeSettings("sk-secret-2"));
    const loaded = await loadSettings();
    expect(loaded!.providers.deepseek.apiKey).toBe("sk-secret-2");
  });

  it("清空 apiKey 后 SecretStore 残留被清除（密钥失效）", async () => {
    await saveSettings(makeSettings("sk-to-clear"));
    expect(await getSecretStore().get(secretKey("provider", "deepseek"))).toBe(
      "sk-to-clear",
    );

    await saveSettings(makeSettings(""));
    expect(
      await getSecretStore().get(secretKey("provider", "deepseek")),
    ).toBeNull();
  });

  it("迁移：旧版明文 settings.json 的 apiKey 被迁入 SecretStore 并返回", async () => {
    const legacy = makeSettings("sk-legacy");
    localStorage.setItem(
      "ppt-agent-data/settings.json",
      JSON.stringify(legacy),
    );

    const loaded = await loadSettings();
    expect(loaded!.providers.deepseek.apiKey).toBe("sk-legacy");
    // 明文已迁入密钥存储
    expect(await getSecretStore().get(secretKey("provider", "deepseek"))).toBe(
      "sk-legacy",
    );
  });

  it("迁移后立即重写磁盘：settings.json 不再含明文 apiKey", async () => {
    const legacy = makeSettings("sk-legacy");
    localStorage.setItem(
      "ppt-agent-data/settings.json",
      JSON.stringify(legacy),
    );

    await loadSettings();

    const raw = localStorage.getItem("ppt-agent-data/settings.json");
    expect(raw).not.toBeNull();
    expect(raw!).not.toContain("sk-legacy");
    const persisted = JSON.parse(raw!) as AppSettings;
    expect(persisted.providers.deepseek.apiKey).toBe("");
  });

  it("迁移：旧版内置 custom provider 转为 custom-legacy，密钥 key 同步迁移", async () => {
    const legacy = makeSettings("sk-custom");
    legacy.providers["custom"] = {
      id: "custom",
      label: "自定义",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-custom",
      model: "my-model",
      enabled: true,
    };
    legacy.activeProvider = "custom" as AppSettings["activeProvider"];
    localStorage.setItem(
      "ppt-agent-data/settings.json",
      JSON.stringify(legacy),
    );

    const loaded = await loadSettings();
    expect(loaded!.providers["custom"]).toBeUndefined();
    expect(loaded!.providers["custom-legacy"]?.baseUrl).toBe(
      "https://api.example.com/v1",
    );
    expect(loaded!.providers["custom-legacy"]?.apiKey).toBe("sk-custom");
    expect(loaded!.activeProvider).toBe("custom-legacy");
    expect(
      await getSecretStore().get(secretKey("provider", "custom-legacy")),
    ).toBe("sk-custom");
  });

  it("迁移：旧版空的 custom provider 直接丢弃", async () => {
    const legacy = makeSettings("");
    legacy.providers["custom"] = {
      id: "custom",
      label: "自定义",
      baseUrl: "",
      apiKey: "",
      model: "",
      enabled: false,
    };
    legacy.activeProvider = "custom" as AppSettings["activeProvider"];
    localStorage.setItem(
      "ppt-agent-data/settings.json",
      JSON.stringify(legacy),
    );

    const loaded = await loadSettings();
    expect(loaded!.providers["custom"]).toBeUndefined();
    expect(loaded!.providers["custom-legacy"]).toBeUndefined();
    expect(loaded!.activeProvider).toBe("deepseek");
  });

  it("迁移：已下线的内置 provider（qwen/zhipu）被移除且密钥被清除", async () => {
    const legacy = makeSettings("");
    legacy.providers["qwen"] = {
      id: "qwen",
      label: "通义千问",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "sk-qwen",
      model: "qwen-max",
      enabled: true,
    };
    legacy.providers["zhipu"] = {
      id: "zhipu",
      label: "智谱 GLM",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      apiKey: "sk-zhipu",
      model: "glm-4-plus",
      enabled: true,
    };
    legacy.activeProvider = "zhipu" as AppSettings["activeProvider"];
    localStorage.setItem(
      "ppt-agent-data/settings.json",
      JSON.stringify(legacy),
    );

    const loaded = await loadSettings();
    expect(loaded!.providers["qwen"]).toBeUndefined();
    expect(loaded!.providers["zhipu"]).toBeUndefined();
    expect(loaded!.activeProvider).toBe("deepseek");
    const store = getSecretStore();
    expect(await store.get(secretKey("provider", "qwen"))).toBeNull();
    expect(await store.get(secretKey("provider", "zhipu"))).toBeNull();
  });
});
