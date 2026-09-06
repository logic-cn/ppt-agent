// 错误 → 建议文案测试（C6，参照 PPT Master error_helper）
import { describe, it, expect } from "vitest";
import { suggestForError, appendErrorSuggestion } from "./error-suggest";

describe("suggestForError", () => {
  it("认证类错误 → 检查 API Key", () => {
    expect(suggestForError("Request failed with status 401")).toBe(
      "errorSuggest.apiKey",
    );
    expect(suggestForError("Incorrect API key provided")).toBe(
      "errorSuggest.apiKey",
    );
  });

  it("限流类错误 → 稍后重试", () => {
    expect(suggestForError("429 Too Many Requests")).toBe(
      "errorSuggest.rateLimit",
    );
    expect(suggestForError("rate limit exceeded")).toBe(
      "errorSuggest.rateLimit",
    );
  });

  it("超时类错误 → 换模型/减页数", () => {
    expect(suggestForError("第 3 页 SVG 生成超时（90 秒）")).toBe(
      "errorSuggest.timeout",
    );
    expect(suggestForError("request timeout")).toBe("errorSuggest.timeout");
  });

  it("网络类错误 → 检查连接/Base URL", () => {
    expect(suggestForError("TypeError: Failed to fetch")).toBe(
      "errorSuggest.network",
    );
    expect(suggestForError("request failed: ENOTFOUND api.openai.com")).toBe(
      "errorSuggest.network",
    );
  });

  it("模型不存在 → 更换模型", () => {
    expect(suggestForError("model gpt-9 not found")).toBe("errorSuggest.model");
  });

  it("无法识别的错误返回 null", () => {
    expect(suggestForError("something unexpected")).toBeNull();
  });

  it("appendErrorSuggestion 拼接建议；无建议返回空串", () => {
    expect(appendErrorSuggestion("401 unauthorized", (k) => `[${k}]`)).toBe(
      "\n\n💡 [errorSuggest.apiKey]",
    );
    expect(appendErrorSuggestion("mystery", (k) => `[${k}]`)).toBe("");
  });
});
