import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSecretStore,
  isUsingSecureSecretStorage,
  makeProviderKey,
  makeImageKey,
} from "@/services/secret-store";

// Node 环境下无 localStorage，提供最小桩实现以验证降级路径
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, v);
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
});

describe("secret-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未检测到系统密钥库时降级到 localStorage 且可用", async () => {
    const store = await getSecretStore();
    await store.setSecret("test-key", "secret-value");
    expect(await store.getSecret("test-key")).toBe("secret-value");
    await store.deleteSecret("test-key");
    expect(await store.getSecret("test-key")).toBeNull();
  });

  it("降级场景下明确标记为非安全存储", async () => {
    await getSecretStore();
    expect(isUsingSecureSecretStorage()).toBe(false);
  });

  it("key 命名规范", () => {
    expect(makeProviderKey("openai")).toBe("provider/openai/api-key");
    expect(makeImageKey()).toBe("image/api-key");
  });
});
