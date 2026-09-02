import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/storage", () => ({
  loadSettings: vi.fn().mockResolvedValue(null),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

import { useSettingsStore } from "@/store/settings";
import type { AppSettings } from "@/types/llm";

function baseSettings(): AppSettings {
  return {
    version: 1,
    activeProvider: "openai",
    providers: {} as AppSettings["providers"],
    imageEnabled: false,
    lang: "zh",
    theme: "system",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({ settings: baseSettings(), loaded: true });
});

describe("useSettingsStore 语言/主题", () => {
  it("setLang 更新语言并保留其余设置", () => {
    useSettingsStore.getState().setLang("en");
    const s = useSettingsStore.getState().settings;
    expect(s.lang).toBe("en");
    expect(s.activeProvider).toBe("openai");
  });

  it("setTheme 更新主题", () => {
    useSettingsStore.getState().setTheme("dark");
    expect(useSettingsStore.getState().settings.theme).toBe("dark");
  });
});
