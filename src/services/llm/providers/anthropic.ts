import type { ChatRequest, ChatResponse } from "@/types/llm";
import type { LLMProviderConfig } from "@/types/llm";
import { httpRequest } from "@/services/http-client";
import { decideRecovery, type FailureKind } from "@/services/recovery";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export class AnthropicProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  async chat(
    req: ChatRequest,
    kind: FailureKind = "outline",
  ): Promise<ChatResponse> {
    const body = {
      model: this.config.model,
      max_tokens: 4096,
      temperature: req.temperature ?? 0.7,
      messages: req.messages.filter((m) => m.role !== "system"),
      system: req.messages.find((m) => m.role === "system")?.content,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const res = await httpRequest(`${this.config.baseUrl}/messages`, {
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
          if (decideRecovery(kind, attempt) === "retry") {
            lastError = new Error(
              `Anthropic API 调用失败 (${res.status}): ${err}`,
            );
            continue;
          }
          throw new Error(`Anthropic API 调用失败 (${res.status}): ${err}`);
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
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        if (
          decideRecovery(kind, attempt, e) === "retry" &&
          req.signal &&
          !req.signal.aborted
        ) {
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
        throw e;
      }
    }
    throw lastError ?? new Error("Anthropic 调用重试失败");
  }

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const body = {
      model: this.config.model,
      max_tokens: 4096,
      temperature: req.temperature ?? 0.7,
      stream: !isTauri,
      messages: req.messages.filter((m) => m.role !== "system"),
      system: req.messages.find((m) => m.role === "system")?.content,
    };

    if (isTauri) {
      // Tauri proxy 不支持流式，退化为非流式
      const res = await httpRequest(`${this.config.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ ...body, stream: false }),
        signal: req.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "未知错误");
        throw new Error(`Anthropic 流式调用失败 (${res.status}): ${err}`);
      }

      const data = await res.json();
      const content = data.content?.[0]?.text ?? "";
      if (content) yield content;
      return;
    }

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
      throw new Error(`Anthropic 流式调用失败 (${res.status}): ${err}`);
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
        if (!line.startsWith("data")) continue;
        const raw = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
        const payload = raw.trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "error") {
            throw new Error(
              `Anthropic API 错误: ${parsed.error?.message ?? JSON.stringify(parsed.error)}`,
            );
          }
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
