import OpenAI from "openai";
import type { ChatRequest, ChatResponse } from "@/types/llm";
import type { LLMProviderConfig } from "@/types/llm";

export class OpenAICompatProvider {
  private client: OpenAI;

  constructor(config: LLMProviderConfig) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
      {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
      };

    if (req.responseFormat === "json") {
      params.response_format = { type: "json_object" };
    }

    const res = await this.client.chat.completions.create(params, {
      signal: req.signal,
    });

    const content = res.choices[0]?.message?.content ?? "";
    return {
      content,
      usage: {
        promptTokens: res.usage?.prompt_tokens,
        completionTokens: res.usage?.completion_tokens,
      },
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
      {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        stream: true,
      };

    if (req.responseFormat === "json") {
      params.response_format = { type: "json_object" };
    }

    const stream = await this.client.chat.completions.create(params, {
      signal: req.signal,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

interface ChatProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<string>;
}

/**
 * 根据 provider 配置创建对应的适配器实例。
 * 支持 OpenAI 兼容协议和 Anthropic 原生协议。
 */
export async function createProviderAsync(
  config: LLMProviderConfig,
): Promise<ChatProvider> {
  if (!config.apiKey) {
    throw new Error(
      `Provider「${config.label}」未配置 API Key，请前往设置页填写。`,
    );
  }
  if (config.id === "anthropic") {
    const { AnthropicProvider } = await import("./providers/anthropic");
    return new AnthropicProvider(config);
  }
  return new OpenAICompatProvider(config);
}

export { type ChatProvider };
