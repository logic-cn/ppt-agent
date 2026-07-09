import { describe, it, expect } from "vitest";
import {
  getTheme,
  resolveTheme,
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
} from "@/themes";

describe("getTheme", () => {
  it("返回正确的主题", () => {
    const theme = getTheme("business-blue");
    expect(theme.id).toBe("business-blue");
    expect(theme.name).toBe("商务深蓝");
  });

  it("未知主题 ID 返回默认主题", () => {
    const theme = getTheme("nonexistent");
    expect(theme.id).toBe(DEFAULT_THEME_ID);
  });
});

describe("resolveTheme", () => {
  it("无 overrides 时返回原始主题", () => {
    const theme = resolveTheme("minimal-white");
    expect(theme.colors.background).toBe("#FFFFFF");
  });

  it("overrides 合并颜色", () => {
    const theme = resolveTheme("business-blue", {
      colors: { primary: "#FF0000" } as any,
    });
    expect(theme.colors.primary).toBe("#FF0000");
    // 其他颜色保持原样
    expect(theme.colors.secondary).toBe("#3B82F6");
  });

  it("overrides 合并 fonts", () => {
    const theme = resolveTheme("business-blue", {
      fonts: { title: "Custom Font", body: "Custom Font" },
    });
    expect(theme.fonts.title).toBe("Custom Font");
  });
});

describe("BUILTIN_THEMES", () => {
  it("有 4 套内置主题", () => {
    expect(BUILTIN_THEMES.length).toBe(4);
  });

  it("每套主题都有完整的 layouts", () => {
    const required = [
      "cover",
      "content",
      "two-column",
      "chart",
      "image",
      "section",
      "closing",
      "cols-2",
      "cols-3",
      "cols-4",
      "cols-5",
      "cols-6",
    ];
    for (const theme of BUILTIN_THEMES) {
      for (const l of required) {
        expect(theme.layouts[l as keyof typeof theme.layouts]).toBeDefined();
      }
    }
  });
});
