import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ChatProvider,
} from "./adapter";
import type {
  ChatRequest,
  ChatResponse,
  LLMProviderConfig,
} from "@/types/llm";

/** 通用 JSON grammar：约束输出为合法 JSON 对象（远程 json mode 的本地等价物） */
const GENERIC_JSON_SCHEMA = { type: "object" } as const;

interface LocalChatResponseDto {
  content: string;
  tokens_generated: number;
  cancelled: boolean;
  truncated: boolean;
  elapsed_ms: number;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * 内置端侧模型 provider：经 Tauri IPC 调用进程内 llama.cpp 推理。
 * - 非流式（Rust 侧一次性返回），chatStream 拿到完整结果后单次 yield
 * - responseFormat/jsonSchema 映射为 grammar 约束解码
 * - AbortSignal 映射为 local_llm_cancel（逐 token 中断）
 */
export class LocalLlmProvider implements ChatProvider {
  constructor(_config: LLMProviderConfig) {}

  async chat(req: ChatRequest, _kind?: string): Promise<ChatResponse> {
    if (!isTauriRuntime()) {
      throw new Error(
        "内置本地模型仅在桌面端可用；浏览器预览请切换到外部模型 API。",
      );
    }

    const messages = req.messages.map((m) => {
      if (typeof m.content !== "string") {
        throw new Error("本地模型不支持图片输入（视觉自检应已被跳过）");
      }
      return { role: m.role, content: m.content };
    });

    const grammarSchema =
      req.jsonSchema ??
      (req.responseFormat === "json" ? GENERIC_JSON_SCHEMA : undefined);

    let aborted = false;
    let onAbort: (() => void) | null = null;
    if (req.signal) {
      if (req.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      onAbort = () => {
        aborted = true;
        void invoke("local_llm_cancel").catch(() => {});
      };
      req.signal.addEventListener("abort", onAbort, { once: true });
    }

    // 流式回调：先订阅 token 事件再发请求（推理串行，不会漏头部增量）
    let unlistenTokens: UnlistenFn | null = null;
    if (req.onPartial) {
      let acc = "";
      unlistenTokens = await listen<{ text: string }>(
        "local-llm-token",
        (e) => {
          acc += e.payload.text;
          req.onPartial?.(acc);
        },
      );
    }

    const invokeChat = (grammar: string | undefined) =>
      invoke<LocalChatResponseDto>("local_llm_chat", {
        req: {
          messages,
          temperature: req.temperature ?? 0.7,
          top_p: req.topP ?? 0.9,
          max_tokens: req.maxTokens ?? 1024,
          grammar_schema: grammar,
        },
      });

    const exactGrammar = grammarSchema
      ? JSON.stringify(grammarSchema)
      : undefined;

    try {
      let res: LocalChatResponseDto;
      try {
        res = await invokeChat(exactGrammar);
      } catch (e) {
        // 精确 schema 转换失败（模型/转换器不支持该结构）时退回通用 JSON 约束
        if (
          exactGrammar &&
          String(e).includes("JSON Schema 转语法失败")
        ) {
          res = await invokeChat(
            req.responseFormat === "json" || req.jsonSchema
              ? JSON.stringify(GENERIC_JSON_SCHEMA)
              : undefined,
          );
        } else {
          throw e;
        }
      }
      if (aborted || res.cancelled) {
        throw new DOMException("Aborted", "AbortError");
      }
      return {
        content: res.content,
        usage: { completionTokens: res.tokens_generated },
      };
    } finally {
      unlistenTokens?.();
      if (req.signal && onAbort) {
        req.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const chunks: string[] = [];
    let wake: (() => void) | null = null;
    let settled = false;
    let lastLen = 0;
    let yieldedAny = false;
    const pending = this.chat({
      ...req,
      onPartial: (acc) => {
        const delta = acc.slice(lastLen);
        lastLen = acc.length;
        if (delta) {
          chunks.push(delta);
          wake?.();
          wake = null;
        }
      },
    }).finally(() => {
      settled = true;
      wake?.();
      wake = null;
    });
    try {
      for (;;) {
        if (chunks.length > 0) {
          yieldedAny = true;
          yield chunks.shift() as string;
          continue;
        }
        if (settled) break;
        await new Promise<void>((r) => {
          wake = r;
        });
      }
      const res = await pending;
      // 没有任何增量事件时退回整段产出，保证流式不可用时内容不丢
      if (!yieldedAny && res.content) yield res.content;
    } finally {
      // 向调用方传播 chat() 的错误（取消/推理失败）
      await pending;
    }
  }

  /** 供 model store / UI 复用：加载模型 */
  static async load(modelPath: string, ctxSize?: number) {
    return invoke("local_llm_load", {
      modelPath,
      ctxSize: ctxSize ?? null,
    });
  }

  static async unload() {
    return invoke("local_llm_unload");
  }

  static async status(): Promise<{
    loaded: boolean;
    model_path: string | null;
    ctx_size: number;
  }> {
    return invoke("local_llm_status");
  }
}

export type { LocalChatResponseDto };
export { GENERIC_JSON_SCHEMA };
