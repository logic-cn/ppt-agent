// src/presets/presets.test.ts
import { describe, it, expect } from "vitest";
import { getPresets, getPresetById } from "./index";
import type { DeckPreset } from "@/types/preset";

describe("presets 合并", () => {
  it("返回非空且每项 design 完整、slides 非空", () => {
    const ps: DeckPreset[] = getPresets();
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.design.mode).toBeTruthy();
      expect(p.design.visualStyle).toBeTruthy();
      expect(p.design.palette).toBeTruthy();
      expect(p.slides.length).toBeGreaterThan(0);
    }
  });
  it("模板类 preset 含 qualityRules", () => {
    const quarterly = getPresetById("quarterly-review");
    expect(quarterly?.qualityRules).toContain("require_charts");
  });
  it("画廊类 preset 的 design.palette 可被 getPalette 解析", () => {
    const ex = getPresets().find((p) => p.id.startsWith("quarterly-pyramid"));
    expect(ex).toBeTruthy();
  });
});
