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
    activeProvider: "deepseek",
    providers: {} as AppSettings["providers"],
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
    expect(s.activeProvider).toBe("deepseek");
  });

  it("setTheme 更新主题", () => {
    useSettingsStore.getState().setTheme("dark");
    expect(useSettingsStore.getState().settings.theme).toBe("dark");
  });
});

describe("useSettingsStore 自定义模型", () => {
  it("addCustomProvider 新增 custom-* 提供商", () => {
    const id = useSettingsStore.getState().addCustomProvider();
    expect(id).toMatch(/^custom-/);
    const cfg = useSettingsStore.getState().settings.providers[id];
    expect(cfg).toBeDefined();
    expect(cfg.baseUrl).toBe("");
    expect(cfg.model).toBe("");
  });

  it("removeCustomProvider 删除并回退到默认本地模型", () => {
    const store = useSettingsStore.getState();
    const id = store.addCustomProvider();
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, activeProvider: id },
    }));
    useSettingsStore.getState().removeCustomProvider(id);
    const s = useSettingsStore.getState().settings;
    expect(s.providers[id]).toBeUndefined();
    // 回退到默认本地模型，避免切到通常没有 API Key 的远程服务
    expect(s.activeProvider).toBe("local");
  });
});
