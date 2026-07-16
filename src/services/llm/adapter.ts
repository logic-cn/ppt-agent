import type { ChatRequest, ChatResponse } from "@/types/llm";
import type { LLMProviderConfig } from "@/types/llm";
import { httpRequest } from "@/services/http-client";
import type { FailureKind } from "@/services/recovery";

/** 标记不可重试的业务错误（如 4xx 鉴权/参数错误），传输层重试循环会直接抛出 */
class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

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
    _kind: FailureKind = "outline",
  ): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
    };

    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.topP !== undefined) body.top_p = req.topP;

    // 未显式指定时给一个较大的默认上限，避免单页 SVG 因 token 耗尽被截断
    // （deepseek-v4-flash 等模型默认上限较小，容易 finish_reason=length）
    if (body.max_tokens === undefined) body.max_tokens = 8000;

    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    let lastError: Error | null = null;

    // 传输层瞬态错误（连接失败 / 5xx / 超时）自动重试，不消耗业务重试预算。
    // sensenova 等代理层偶发抖动会被这里吸收，避免单次网络失败即整体失败。
    const MAX_TRANSPORT_RETRY = 4;
    for (let transport = 0; transport <= MAX_TRANSPORT_RETRY; transport++) {
      if (transport > 0) {
        const delay = Math.min(1000 * 2 ** transport, 8000);
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
          // 4xx（鉴权/参数错误）属于业务错误，标记后直接抛出，不应重试
          if (res.status >= 400 && res.status < 500) {
            throw new NonRetryableError(
              `LLM API 调用失败 (${res.status}): ${err}`,
            );
          }
          // 5xx 等服务端瞬态错误，进入下一轮传输层重试
          lastError = new Error(`LLM API 调用失败 (${res.status}): ${err}`);
          continue;
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
        if (e instanceof NonRetryableError) throw e;
        lastError = e instanceof Error ? e : new Error(String(e));
        // 传输层错误（含网络/连接/超时）继续重试
        continue;
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
      // 传输层瞬态错误自动重试，避免代理层偶发抖动导致单次失败即整体失败
      const MAX_TRANSPORT_RETRY = 4;
      let lastError: Error | null = null;
      for (let transport = 0; transport <= MAX_TRANSPORT_RETRY; transport++) {
        if (transport > 0) {
          const delay = Math.min(1000 * 2 ** transport, 8000);
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
              body: JSON.stringify({ ...body, stream: false }),
              signal: req.signal,
            },
          );

          if (!res.ok) {
            const err = await res.text().catch(() => "未知错误");
            // 4xx 业务错误直接抛出，不重试
            if (res.status >= 400 && res.status < 500) {
              throw new NonRetryableError(
                `LLM 流式调用失败 (${res.status}): ${err}`,
              );
            }
            lastError = new Error(`LLM 流式调用失败 (${res.status}): ${err}`);
            continue;
          }

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          if (content) yield content;
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") throw e;
          if (e instanceof NonRetryableError) throw e;
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }
      }
      throw lastError ?? new Error("LLM 流式调用重试失败");
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
