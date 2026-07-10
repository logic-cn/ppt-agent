export interface SecretStore {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

const SECRET_PREFIX = "ppt-agent:secret:";
const KEYCHAIN_SERVICE = "ppt-agent";
const KEYCHAIN_MODULE = "@tauri-apps/plugin-keychain";

let instance: SecretStore | null = null;
let usingSecure = false;

/**
 * 尝试加载 Tauri 系统密钥库（macOS Keychain / 对应平台的系统凭据）。
 * 通过动态 import + 字符串说明符加载，避免在未安装插件时编译报错；
 * 任何加载/调用失败都返回 null，由调用方降级到 localStorage。
 *
 * 启用系统密钥库所需（Rust 侧，不在前端构建范围）：
 *   1. `pnpm add @tauri-apps/plugin-keychain`
 *   2. src-tauri/Cargo.toml 增加 `tauri-plugin-keychain = "2"`
 *   3. lib.rs 中 `.plugin(tauri_plugin_keychain::init())`
 *   4. capabilities 中授予 `keychain:allow-*` 权限
 */
async function loadKeychain(): Promise<{
  getPassword: (service: string, account: string) => Promise<string | null>;
  setPassword: (
    service: string,
    account: string,
    password: string,
  ) => Promise<void>;
  deletePassword: (service: string, account: string) => Promise<void>;
} | null> {
  try {
    const mod = (await import(/* @vite-ignore */ KEYCHAIN_MODULE)) as {
      keychain?: {
        getPassword: (s: string, a: string) => Promise<string | null>;
        setPassword: (s: string, a: string, p: string) => Promise<void>;
        deletePassword: (s: string, a: string) => Promise<void>;
      };
    };
    return mod.keychain ?? null;
  } catch {
    return null;
  }
}

function createLocalStore(): SecretStore {
  return {
    async getSecret(key: string): Promise<string | null> {
      return localStorage.getItem(SECRET_PREFIX + key);
    },
    async setSecret(key: string, value: string): Promise<void> {
      localStorage.setItem(SECRET_PREFIX + key, value);
    },
    async deleteSecret(key: string): Promise<void> {
      localStorage.removeItem(SECRET_PREFIX + key);
    },
  };
}

function createKeychainStore(
  keychain: NonNullable<Awaited<ReturnType<typeof loadKeychain>>>,
): SecretStore {
  return {
    async getSecret(key: string): Promise<string | null> {
      try {
        return (await keychain.getPassword(KEYCHAIN_SERVICE, key)) ?? null;
      } catch {
        return null;
      }
    },
    async setSecret(key: string, value: string): Promise<void> {
      await keychain.setPassword(KEYCHAIN_SERVICE, key, value);
    },
    async deleteSecret(key: string): Promise<void> {
      try {
        await keychain.deletePassword(KEYCHAIN_SERVICE, key);
      } catch {
        /* 忽略删除失败 */
      }
    },
  };
}

/** 当前是否在使用系统安全存储（而非本地明文降级） */
export function isUsingSecureSecretStorage(): boolean {
  return usingSecure;
}

export async function getSecretStore(): Promise<SecretStore> {
  if (!instance) {
    const keychain = await loadKeychain();
    if (keychain) {
      instance = createKeychainStore(keychain);
      usingSecure = true;
    } else {
      instance = createLocalStore();
      usingSecure = false;
    }
  }
  return instance;
}

export function makeProviderKey(providerId: string): string {
  return `provider/${providerId}/api-key`;
}

export function makeImageKey(): string {
  return `image/api-key`;
}
