import { describe, it, expect } from "vitest";
import { getPalette, setCustomPalettes, PALETTES } from "./palettes";
import { contrastRatio } from "@/engine/svg/quality/checker";
import type { Palette } from "./palettes";

const hex = (c: string) => c.replace("#", "").toUpperCase();

describe("内置配色可访问性不变量（WCAG AA）", () => {
  it("每个内置配色的正文/弱化文字对背景与 surface 均 ≥4.5:1", () => {
    for (const p of PALETTES) {
      const { background, surface, text, textMuted } = p.colors;
      const pairs: [string, string, string][] = [
        ["text/bg", text, background],
        ["text/surface", text, surface],
        ["muted/bg", textMuted, background],
        ["muted/surface", textMuted, surface],
      ];
      for (const [label, a, b] of pairs) {
        expect(
          contrastRatio(hex(a), hex(b)),
          `${p.id} ${label} 对比度不足`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("内置配色不少于 12 套", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(12);
  });
});

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
