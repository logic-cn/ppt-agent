import { describe, it, expect } from "vitest";
import { getPalette, setCustomPalettes, PALETTES } from "./palettes";
import type { Palette } from "./palettes";

describe("getPalette 自定义配色", () => {
  it("内置 id 可解析", () => {
    expect(getPalette("business-blue")?.colors.primary).toBe("#60A5FA");
  });
  it("自定义 id 在 setCustomPalettes 后可解析", () => {
    const custom: Palette = {
      id: "custom-1",
      name: "测试配色",
      colors: {
        primary: "#123456",
        secondary: "#234567",
        accent: "#345678",
        background: "#ffffff",
        surface: "#f5f5f5",
        text: "#111111",
        textMuted: "#666666",
      },
    };
    setCustomPalettes([custom]);
    expect(getPalette("custom-1")?.colors.primary).toBe("#123456");
    setCustomPalettes([]);
  });
  it("未知 id 返回 undefined", () => {
    expect(getPalette("nope")).toBeUndefined();
  });
  it("内置配色不少于 4", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(4);
  });
});
