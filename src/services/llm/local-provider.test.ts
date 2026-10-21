// LocalLlmProvider：IPC 序列化 / grammar 映射 / 取消语义 / 通用 JSON 兜底
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invoke = vi.fn();
type TokenCb = (e: { payload: { text: string } }) => void;
let tokenCb: TokenCb | null = null;
const listen = vi.fn(async (_event: string, cb: TokenCb) => {
  tokenCb = cb;
  return () => {
    tokenCb = null;
  };
});
const emitToken = (text: string) => tokenCb?.({ payload: { text } });

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) =>
    (listen as (...a: unknown[]) => Promise<() => void>)(...args),
}));

import {
  LocalLlmProvider,
  GENERIC_JSON_SCHEMA,
  type LocalChatResponseDto,
} from "./local-provider";
import type { ChatRequest } from "@/types/llm";

const DTO = (over: Partial<LocalChatResponseDto> = {}) => ({
  content: "ok",
  tokens_generated: 10,
  cancelled: false,
  truncated: false,
  elapsed_ms: 100,
  ...over,
});

function req(over: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: "local",
    messages: [{ role: "user", content: "hi" }],
    ...over,
  } as ChatRequest;
}

let provider: LocalLlmProvider;

beforeEach(() => {
  invoke.mockReset();
  listen.mockClear();
  tokenCb = null;
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  provider = new LocalLlmProvider({} as never);
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("LocalLlmProvider.chat", () => {
  it("非 Tauri 环境（浏览器预览）明确报错", async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    await expect(provider.chat(req())).rejects.toThrow("仅在桌面端可用");
  });

  it("成功链路：序列化消息、默认采样参数、返回 usage", async () => {
    invoke.mockResolvedValue(DTO({ content: "你好" }));
    const res = await provider.chat(req({ temperature: 0.3 }));
    expect(res.content).toBe("你好");
    expect(res.usage?.completionTokens).toBe(10);
    expect(invoke).toHaveBeenCalledWith("local_llm_chat", {
      req: {
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 1024,
        grammar_schema: undefined,
      },
    });
  });

  it("jsonSchema 透传为 grammar；responseFormat=json 用通用 JSON 约束", async () => {
    invoke.mockResolvedValue(DTO());
    const schema = { type: "object", required: ["pages"] };
    await provider.chat(req({ jsonSchema: schema as never }));
    expect(invoke.mock.calls[0]![1]).toEqual({
      req: expect.objectContaining({ grammar_schema: JSON.stringify(schema) }),
    });

    await provider.chat(req({ responseFormat: "json" }));
    expect(invoke.mock.calls[1]![1]).toEqual({
      req: expect.objectContaining({
        grammar_schema: JSON.stringify(GENERIC_JSON_SCHEMA),
      }),
    });
  });

  it("精确 schema 转语法失败时退回通用 JSON 约束重调", async () => {
    invoke
      .mockRejectedValueOnce(new Error("JSON Schema 转语法失败: xx"))
      .mockResolvedValueOnce(DTO({ content: "{}" }));
    const res = await provider.chat(
      req({ jsonSchema: { type: "object" } as never }),
    );
    expect(res.content).toBe("{}");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1]![1]).toEqual({
      req: expect.objectContaining({
        grammar_schema: JSON.stringify(GENERIC_JSON_SCHEMA),
      }),
    });
  });

  it("其他 IPC 错误直接抛出，不触发兜底", async () => {
    invoke.mockRejectedValue(new Error("模型未加载"));
    await expect(provider.chat(req())).rejects.toThrow("模型未加载");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("signal 已中止 / Rust 侧 cancelled 均映射为 AbortError", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      provider.chat(req({ signal: ac.signal })),
    ).rejects.toMatchObject({
      name: "AbortError",
    });

    invoke.mockResolvedValue(DTO({ cancelled: true }));
    const ac2 = new AbortController();
    await expect(
      provider.chat(req({ signal: ac2.signal })),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("推理中途 abort 触发 local_llm_cancel 并以 AbortError 结束", async () => {
    const ac = new AbortController();
    invoke.mockImplementation(
      () =>
        new Promise((_r, rej) => {
          ac.signal.addEventListener("abort", () => {
            rej(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const p = provider.chat(req({ signal: ac.signal }));
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    // cancel IPC 是 fire-and-forget，等一个微任务
    await Promise.resolve();
    expect(invoke).toHaveBeenCalledWith("local_llm_cancel");
  });

  it("图片输入明确拒绝（本地档非多模态）", async () => {
    await expect(
      provider.chat(
        req({
          messages: [
            {
              role: "user",
              content: [{ type: "image", image: "data:," }],
            } as never,
          ],
        }),
      ),
    ).rejects.toThrow("不支持图片输入");
  });

  it("chatStream 一次性产出完整内容；空内容不产出", async () => {
    invoke.mockResolvedValue(DTO({ content: "abc" }));
    const chunks: string[] = [];
    for await (const c of provider.chatStream(req())) chunks.push(c);
    expect(chunks).toEqual(["abc"]);

    invoke.mockResolvedValue(DTO({ content: "" }));
    const empty: string[] = [];
    for await (const c of provider.chatStream(req())) empty.push(c);
    expect(empty).toEqual([]);
  });

  it("静态 load/unload/status 透传命令", async () => {
    invoke.mockResolvedValue(DTO());
    await LocalLlmProvider.load("/m/x.gguf");
    expect(invoke).toHaveBeenLastCalledWith("local_llm_load", {
      modelPath: "/m/x.gguf",
      ctxSize: null,
    });
    await LocalLlmProvider.load("/m/x.gguf", 8192);
    expect(invoke).toHaveBeenLastCalledWith("local_llm_load", {
      modelPath: "/m/x.gguf",
      ctxSize: 8192,
    });
    await LocalLlmProvider.unload();
    expect(invoke).toHaveBeenLastCalledWith("local_llm_unload");
    await LocalLlmProvider.status();
    expect(invoke).toHaveBeenLastCalledWith("local_llm_status");
  });
});

describe("LocalLlmProvider 流式输出", () => {
  it("onPartial 收到累积增量文本，完成后自动退订", async () => {
    invoke.mockImplementation(async () => {
      emitToken("aa");
      emitToken("bb");
      return DTO({ content: "aabb" });
    });
    const seen: string[] = [];
    const res = await provider.chat(req({ onPartial: (t) => seen.push(t) }));
    expect(seen).toEqual(["aa", "aabb"]);
    expect(res.content).toBe("aabb");
    expect(tokenCb).toBeNull();
  });

  it("chatStream 按 token 事件增量产出；无事件时退回整段", async () => {
    invoke.mockImplementation(async () => {
      emitToken("<svg>");
      emitToken("</svg>");
      return DTO({ content: "<svg></svg>" });
    });
    const chunks: string[] = [];
    for await (const c of provider.chatStream(req())) chunks.push(c);
    expect(chunks).toEqual(["<svg>", "</svg>"]);

    invoke.mockReset();
    invoke.mockImplementation(async () => DTO({ content: "abc" }));
    const single: string[] = [];
    for await (const c of provider.chatStream(req())) single.push(c);
    expect(single).toEqual(["abc"]);
  });

  it("不传 onPartial 时不订阅 token 事件", async () => {
    invoke.mockResolvedValue(DTO());
    await provider.chat(req());
    expect(listen).not.toHaveBeenCalled();
  });
});
