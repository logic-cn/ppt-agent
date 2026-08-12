import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/llm/adapter", () => ({
  createProviderAsync: vi.fn(),
}));

import {
  getActiveProviderConfig,
  chat,
  chatStream,
} from "@/services/llm/index";
import { createProviderAsync } from "@/services/llm/adapter";
import { useSettingsStore } from "@/store/settings";
import type { ChatProvider } from "@/services/llm/adapter";

function setSettings(apiKey: string | null) {
  useSettingsStore.setState({
    settings: {
      ...useSettingsStore.getState().settings,
      activeProvider: "openai",
      providers: {
        ...useSettingsStore.getState().settings.providers,
        openai: {
          ...useSettingsStore.getState().settings.providers.openai,
          apiKey: apiKey ?? "",
          model: "gpt-4o-mini",
          baseUrl: "https://api.openai.com/v1",
          label: "OpenAI",
          enabled: true,
        },
      },
    },
  });
}

describe("getActiveProviderConfig", () => {
  it("未配置 API Key 时抛错", () => {
    setSettings(null);
    expect(() => getActiveProviderConfig()).toThrow(/未配置 API Key/);
  });

  it("返回当前激活 provider 的配置", () => {
    setSettings("sk-test");
    const config = getActiveProviderConfig();
    expect(config.apiKey).toBe("sk-test");
    expect(config.model).toBe("gpt-4o-mini");
  });
});

describe("chat", () => {
  it("调用 provider.chat 并返回响应", async () => {
    setSettings("sk-test");
    const providerMock: ChatProvider = {
      chat: vi.fn(async () => ({ content: "回答", usage: undefined })),
      chatStream: vi.fn(async function* () {}),
    };
    vi.mocked(createProviderAsync).mockResolvedValue(providerMock);

    const res = await chat({ messages: [{ role: "user", content: "hi" }] });
    expect(res.content).toBe("回答");
    expect(vi.mocked(createProviderAsync)).toHaveBeenCalledTimes(1);
    expect(providerMock.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" }),
      "outline",
    );
  });
});

describe("chatStream", () => {
  it("逐段产出 provider 流式内容", async () => {
    setSettings("sk-test");
    const providerMock: ChatProvider = {
      chat: vi.fn(),
      chatStream: vi.fn(async function* () {
        yield "你";
        yield "好";
      }),
    };
    vi.mocked(createProviderAsync).mockResolvedValue(providerMock);

    const chunks: string[] = [];
    for await (const chunk of chatStream({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["你", "好"]);
  });
});
