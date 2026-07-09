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
    expect(theme.colors.secondary).toBe("#3B6EA5");
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
    for (const theme of BUILTIN_THEMES) {
      expect(theme.layouts.cover).toBeDefined();
      expect(theme.layouts.content).toBeDefined();
      expect(theme.layouts["two-column"]).toBeDefined();
      expect(theme.layouts.chart).toBeDefined();
      expect(theme.layouts.image).toBeDefined();
      expect(theme.layouts.section).toBeDefined();
      expect(theme.layouts.closing).toBeDefined();
    }
  });
});
