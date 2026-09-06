import type { Lang, ThemeMode } from "./preferences";

export type LLMProviderId =
  "openai" | "anthropic" | "qwen" | "zhipu" | "custom";

export interface LLMProviderConfig {
  id: LLMProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: "text" | "json";
  signal?: AbortSignal;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface ImageGenRequest {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
}

export interface ImageGenResponse {
  url: string;
  revisedPrompt?: string;
  /** 图片生成失败降级为占位图时为 true，调用方应继续而非中断整份演示 */
  placeholder?: boolean;
}

export interface AppSettings {
  version: number;
  activeProvider: LLMProviderId;
  providers: Record<LLMProviderId, LLMProviderConfig>;
  imageProvider?: LLMProviderConfig;
  imageEnabled: boolean;
  /** 网络搜图 Pexels API Key（可选；缺省仅用 Openverse 零配置源，C4） */
  pexelsApiKey?: string;
  lang: Lang;
  theme: ThemeMode;
}

export const PROVIDER_PRESETS: Record<
  LLMProviderId,
  Omit<LLMProviderConfig, "apiKey" | "enabled">
> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
  },
  qwen: {
    id: "qwen",
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
  },
  zhipu: {
    id: "zhipu",
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
  },
  custom: {
    id: "custom",
    label: "自定义",
    baseUrl: "",
    model: "",
  },
};
