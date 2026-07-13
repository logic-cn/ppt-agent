import type { ChatRequest, ChatResponse } from "@/types/llm";
import type { LLMProviderConfig } from "@/types/llm";
import { httpRequest } from "@/services/http-client";
import { decideRecovery, type FailureKind } from "@/services/recovery";

/**
 * OpenAI 兼容协议的 Provider 适配器。
 * 基于 fetch，支持 Tauri 环境下通过 Rust proxy 绕过 CORS。
 */
export class OpenAICompatProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  async chat(
    req: ChatRequest,
    kind: FailureKind = "outline",
  ): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
    };

    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.topP !== undefined) body.top_p = req.topP;

    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const res = await httpRequest(
          `${this.config.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: req.signal,
          },
        );

        if (!res.ok) {
          const err = await res.text().catch(() => "未知错误");
          // 429/502/503 等可重试错误，交由决策矩阵决定是否继续
          if (decideRecovery(kind, attempt) === "retry") {
            lastError = new Error(`LLM API 调用失败 (${res.status}): ${err}`);
            continue;
          }
          throw new Error(`LLM API 调用失败 (${res.status}): ${err}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        return {
          content,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
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
    throw lastError ?? new Error("LLM 调用重试失败");
  }

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      stream: true,
    };

    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    if (isTauri()) {
      // Tauri 环境：走 Rust proxy，不支持流式，退化为非流式
      const res = await httpRequest(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ ...body, stream: false }),
        signal: req.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "未知错误");
        throw new Error(`LLM 流式调用失败 (${res.status}): ${err}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content) yield content;
      return;
    }

    // 浏览器环境：用原生 fetch 流式，带 120s 超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    if (req.signal) {
      req.signal.addEventListener("abort", () => controller.abort());
    }
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text().catch(() => "未知错误");
      throw new Error(`LLM 流式调用失败 (${res.status}): ${err}`);
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
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip
        }
      }
    }
  }
}

interface ChatProvider {
  chat(req: ChatRequest, kind?: FailureKind): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<string>;
}

/**
 * 根据 provider 配置创建对应的适配器实例。
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

export type { ChatProvider };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
