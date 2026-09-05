// src/services/generation/generation-options.test.ts
import { describe, it, expect } from "vitest";
import { languageFromAppLang, withAppLanguage } from "./generation-options";

describe("generation-options", () => {
  it("应用语言映射：zh→zh-CN、en→en-US", () => {
    expect(languageFromAppLang("zh")).toBe("zh-CN");
    expect(languageFromAppLang("en")).toBe("en-US");
  });

  it("withAppLanguage 填充缺失的 language", () => {
    expect(withAppLanguage({ tone: "formal" }, "en")).toEqual({
      tone: "formal",
      language: "en-US",
    });
    expect(withAppLanguage({}, "zh")).toEqual({ language: "zh-CN" });
  });

  it("withAppLanguage 不覆盖显式指定的 language", () => {
    expect(withAppLanguage({ language: "en-US" }, "zh")).toEqual({
      language: "en-US",
    });
  });
});
