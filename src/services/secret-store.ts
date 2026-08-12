/**
 * 密钥存储（P0-3）：API Key 不与 settings.json 同盘。
 *
 * Tauri 环境经系统 keychain（Rust `keyring` command），Web/jsdom 降级 localStorage。
 * 业务层只依赖 SecretStore 接口，不要在 Settings 页面直接调用 Tauri API。
 */

export type SecretScope = "provider" | "image";

export interface SecretStore {
  /** 是否为系统安全存储（keychain）；localStorage 降级为 false */
  readonly secure: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export function secretKey(scope: SecretScope, id: string): string {
  return `ppt-agent/secret/${scope}/${id}/api-key`;
}

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

class TauriSecretStore implements SecretStore {
  readonly secure = true;

  private async invoke(): Promise<
    (cmd: string, args: Record<string, string>) => Promise<unknown>
  > {
    const mod = await import("@tauri-apps/api/core");
    return mod.invoke as (
      cmd: string,
      args: Record<string, string>,
    ) => Promise<unknown>;
  }

  async get(key: string): Promise<string | null> {
    const inv = await this.invoke();
    const value = (await inv("secret_get", { key })) as string | null;
    return value || null;
  }

  async set(key: string, value: string): Promise<void> {
    const inv = await this.invoke();
    await inv("secret_set", { key, value });
  }

  async delete(key: string): Promise<void> {
    const inv = await this.invoke();
    await inv("secret_delete", { key });
  }
}

// Web/jsdom 降级实现：localStorage 明文保存，用于开发/纯 Web 部署
class LocalSecretStore implements SecretStore {
  readonly secure = false;
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

let store: SecretStore | null = null;

export function getSecretStore(): SecretStore {
  if (!store) {
    store = isTauri ? new TauriSecretStore() : new LocalSecretStore();
  }
  return store;
}

/** 测试用：重置单例，改用注入的实现 */
export function resetSecretStore(impl?: SecretStore | null): void {
  store = impl ?? null;
}
