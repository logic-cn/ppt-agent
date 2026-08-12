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
    activeProvider: "openai",
    providers,
    imageEnabled: false,
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
    expect(persisted.providers.openai.apiKey).toBe("");
    expect(persisted.providers.openai.enabled).toBe(true);

    const store = getSecretStore();
    expect(await store.get(secretKey("provider", "openai"))).toBe(
      "sk-secret-1",
    );
  });

  it("loadSettings 从 SecretStore 合并回 apiKey", async () => {
    await saveSettings(makeSettings("sk-secret-2"));
    const loaded = await loadSettings();
    expect(loaded!.providers.openai.apiKey).toBe("sk-secret-2");
  });

  it("清空 apiKey 后 SecretStore 残留被清除（密钥失效）", async () => {
    await saveSettings(makeSettings("sk-to-clear"));
    expect(await getSecretStore().get(secretKey("provider", "openai"))).toBe(
      "sk-to-clear",
    );

    await saveSettings(makeSettings(""));
    expect(
      await getSecretStore().get(secretKey("provider", "openai")),
    ).toBeNull();
  });

  it("迁移：旧版明文 settings.json 的 apiKey 被迁入 SecretStore 并返回", async () => {
    const legacy = makeSettings("sk-legacy");
    localStorage.setItem(
      "ppt-agent-data/settings.json",
      JSON.stringify(legacy),
    );

    const loaded = await loadSettings();
    expect(loaded!.providers.openai.apiKey).toBe("sk-legacy");
    // 明文已迁入密钥存储
    expect(await getSecretStore().get(secretKey("provider", "openai"))).toBe(
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
    expect(persisted.providers.openai.apiKey).toBe("");
  });
});
