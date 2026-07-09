import type { ChatRequest, ChatResponse } from "@/types/llm";
import type { LLMProviderConfig } from "@/types/llm";

/**
 * Anthropic API 适配器。
 * 使用 /v1/messages 端点，与 OpenAI 协议不同。
 */
export class AnthropicProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body = {
      model: this.config.model,
      max_tokens: 4096,
      temperature: req.temperature ?? 0.7,
      messages: req.messages.filter((m) => m.role !== "system"),
      system: req.messages.find((m) => m.role === "system")?.content,
    };

    const res = await fetch(`${this.config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "未知错误");
      throw new Error(`Anthropic API 调用失败: ${err}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text ?? "";
    return {
      content,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
      },
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const body = {
      model: this.config.model,
      max_tokens: 4096,
      temperature: req.temperature ?? 0.7,
      stream: true,
      messages: req.messages.filter((m) => m.role !== "system"),
      system: req.messages.find((m) => m.role === "system")?.content,
    };

    const res = await fetch(`${this.config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "未知错误");
      throw new Error(`Anthropic 流式调用失败: ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta") {
            yield parsed.delta?.text ?? "";
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}
