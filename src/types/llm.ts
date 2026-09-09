import type { Lang, ThemeMode } from "./preferences";

/** 内置提供商（预设固定） */
export type BuiltinProviderId = "deepseek";
/** 自定义提供商 id 约定：custom- 前缀 + 随机串 */
export type CustomProviderId = `custom-${string}`;

export type LLMProviderId = BuiltinProviderId | CustomProviderId;

export interface LLMProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

/** 视觉消息内容块（OpenAI 兼容格式；D3 视觉自检使用） */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
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

export interface AppSettings {
  version: number;
  activeProvider: LLMProviderId;
  /** 内置 + 自定义提供商统一存放在此 map，key 为 provider id */
  providers: Record<string, LLMProviderConfig>;
  /** 网络搜图 Pexels API Key（可选；缺省仅用 Openverse 零配置源，C4） */
  pexelsApiKey?: string;
  /** 联网资料补全（Tavily，D4）：topic-only 生成前检索资料作为上下文 */
  researchEnabled?: boolean;
  tavilyApiKey?: string;
  lang: Lang;
  theme: ThemeMode;
}

export const PROVIDER_PRESETS: Record<
  BuiltinProviderId,
  Omit<LLMProviderConfig, "apiKey" | "enabled">
> = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
};
