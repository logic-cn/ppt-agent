import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSecretStore,
  resetSecretStore,
  secretKey,
  type SecretStore,
} from "./secret-store";

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

describe("secret-store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    resetSecretStore();
  });

  it("secretKey 命名空间规范", () => {
    expect(secretKey("provider", "openai")).toBe(
      "ppt-agent/secret/provider/openai/api-key",
    );
    expect(secretKey("image", "default")).toBe(
      "ppt-agent/secret/image/default/api-key",
    );
  });

  it("LocalSecretStore 写读删 roundtrip", async () => {
    const store = getSecretStore();
    // 非 Tauri 环境（jsdom）降级 localStorage
    expect(store.secure).toBe(false);

    const key = secretKey("provider", "openai");
    expect(await store.get(key)).toBeNull();

    await store.set(key, "sk-test-123");
    expect(await store.get(key)).toBe("sk-test-123");

    await store.delete(key);
    expect(await store.get(key)).toBeNull();
  });

  it("resetSecretStore 可注入自定义实现", async () => {
    const fake: SecretStore = {
      secure: true,
      get: async () => "injected",
      set: async () => {},
      delete: async () => {},
    };
    resetSecretStore(fake);
    expect(getSecretStore()).toBe(fake);
    expect(getSecretStore().secure).toBe(true);
  });
});