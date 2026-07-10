export interface SecretStore {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

const SECRET_PREFIX = "ppt-agent:secret:";

let instance: SecretStore | null = null;

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

export function getSecretStore(): SecretStore {
  if (!instance) {
    instance = createLocalStore();
  }
  return instance;
}

export function makeProviderKey(providerId: string): string {
  return `provider/${providerId}/api-key`;
}

export function makeImageKey(): string {
  return `image/api-key`;
}
