import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAICompatProvider } from "./adapter";
import type { LLMProviderConfig, ChatRequest } from "@/types/llm";

const baseConfig: LLMProviderConfig = {
  id: "custom",
  label: "自定义",
  baseUrl: "https://token.sensenova.cn/v1",
  model: "deepseek-v4-flash",
  apiKey: "test-key",
  enabled: true,
};

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal("window", {});
  originalFetch = globalThis.fetch;
  // 消除重试退避等待，加速测试
  vi.stubGlobal("setTimeout", (fn: () => void) => fn() as unknown);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

function makeReq(over: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "hi" }],
    ...over,
  };
}

function okResponse(content: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    }),
  } as unknown as Response;
}

function errResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    text: async () => text,
  } as unknown as Response;
}

describe("OpenAICompatProvider.chat 传输层重试", () => {
  it(
    "网络瞬态错误（连接失败）重试后成功，不抛错",
    async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockRejectedValueOnce(new Error("fail3"))
      .mockRejectedValueOnce(new Error("fail4"))
      .mockResolvedValueOnce(okResponse("<svg>ok</svg>"));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const p = new OpenAICompatProvider(baseConfig);
    const res = await p.chat(makeReq());
    expect(res.content).toBe("<svg>ok</svg>");
    expect(fetchMock.mock.calls.length).toBe(5);
  },
    20000,
  );

  it("4xx 业务错误直接抛出，不重试", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(401, "Unauthorized"));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const p = new OpenAICompatProvider(baseConfig);
    await expect(p.chat(makeReq())).rejects.toThrow("401");
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it("5xx 服务端错误重试后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(errResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(okResponse("done"));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const p = new OpenAICompatProvider(baseConfig);
    const res = await p.chat(makeReq());
    expect(res.content).toBe("done");
    expect(fetchMock.mock.calls.length).toBe(3);
  });
});
