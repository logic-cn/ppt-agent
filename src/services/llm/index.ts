import type { ChatRequest, ChatResponse } from "@/types/llm";
import type { LLMProviderConfig } from "@/types/llm";
import { isLocalProviderConfig } from "@/types/llm";
import { createProviderAsync, type ChatProvider } from "./adapter";
import type { FailureKind } from "@/services/recovery";
import { useSettingsStore } from "@/store/settings";

/** 当前激活的模型是否为内置本地模型（用于精简 prompt 等本地档策略） */
export function isLocalModelActive(): boolean {
  try {
    const { settings } = useSettingsStore.getState();
    const config = settings.providers[settings.activeProvider];
    return !!config && isLocalProviderConfig(config);
  } catch {
    return false;
  }
}

/** 获取当前激活的 provider 配置 */
export function getActiveProviderConfig(): LLMProviderConfig {
  const { settings } = useSettingsStore.getState();
  const config = settings.providers[settings.activeProvider];
  if (!config) {
    throw new Error(
      `当前模型「${settings.activeProvider}」不存在，请前往设置页检查配置。`,
    );
  }
  // 内置本地模型无需 API Key
  if (!config.apiKey && !isLocalProviderConfig(config)) {
    throw new Error(
      `当前模型「${settings.activeProvider}」未配置 API Key，请前往设置页填写。`,
    );
  }
  return config;
}

/** 获取当前激活的 provider 适配器实例（异步） */
export async function getActiveProviderAsync(): Promise<ChatProvider> {
  return createProviderAsync(getActiveProviderConfig());
}

/** 便捷封装：非流式聊天 */
export async function chat(
  req: Omit<ChatRequest, "model">,
  kind: FailureKind = "outline",
): Promise<ChatResponse> {
  const config = getActiveProviderConfig();
  const provider = await createProviderAsync(config);
  return provider.chat({ ...req, model: config.model }, kind);
}

/** 便捷封装：流式聊天 */
export async function* chatStream(
  req: Omit<ChatRequest, "model">,
): AsyncIterable<string> {
  const config = getActiveProviderConfig();
  const provider = await createProviderAsync(config);
  yield* provider.chatStream({ ...req, model: config.model });
}

export type { ChatProvider };
