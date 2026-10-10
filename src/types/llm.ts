import type { Lang, ThemeMode } from "./preferences";

/** 内置提供商（预设固定）。local 为内置端侧小模型，无需任何 API Key */
export type BuiltinProviderId = "local" | "deepseek";
/** 自定义提供商 id 约定：custom- 前缀 + 随机串 */
export type CustomProviderId = `custom-${string}`;

export type LLMProviderId = BuiltinProviderId | CustomProviderId;

/** openai-compat：远程 OpenAI 兼容 API；local：进程内 llama.cpp 推理 */
export type ProviderKind = "openai-compat" | "local";

export interface LLMProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  /** 缺省视为 openai-compat */
  kind?: ProviderKind;
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
  /**
   * JSON Schema（本地 provider 用 grammar 约束解码；远程 provider 忽略此字段）。
   * 提供时隐含 responseFormat==="json"。
   */
  jsonSchema?: unknown;
  /**
   * 本地 provider 流式回调：随生成增量收到累积文本（远程 provider 忽略）。
   * 仅用于 UI 实时展示，最终结果以 chat() 返回值为准。
   */
  onPartial?: (accumulatedText: string) => void;
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
  /** 内置本地模型档位（缺省 standard=2B） */
  localModelTier?: "standard" | "light";
}

export const PROVIDER_PRESETS: Record<
  BuiltinProviderId,
  Omit<LLMProviderConfig, "apiKey" | "enabled">
> = {
  local: {
    id: "local",
    label: "本地模型（内置）",
    baseUrl: "",
    model: "minicpm5-2b",
    kind: "local",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
};

/** 是否内置本地模型配置（无需 API Key，走进程内 llama.cpp） */
export function isLocalProviderConfig(config: LLMProviderConfig): boolean {
  return config.kind === "local" || config.id === "local";
}
