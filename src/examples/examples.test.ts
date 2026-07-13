import { describe, it, expect } from "vitest";
import { getExamples } from "./index";
import { isDesignLock } from "../types/design";
import { slideSchema } from "../services/storage/deck-schema";

describe("内置样例画廊", () => {
  const examples = getExamples();

  it("返回 5-8 条样例", () => {
    expect(examples.length).toBeGreaterThanOrEqual(5);
    expect(examples.length).toBeLessThanOrEqual(8);
  });

  it("每条 design 都是合法的 DesignLock", () => {
    for (const ex of examples) {
      expect(isDesignLock(ex.design)).toBe(true);
    }
  });

  it("每条 slides 都是合法 Slide[]", () => {
    for (const ex of examples) {
      expect(Array.isArray(ex.slides)).toBe(true);
      for (const slide of ex.slides) {
        const result = slideSchema.safeParse(slide);
        expect(result.success, `slide ${slide.id} 校验失败`).toBe(true);
      }
    }
  });

  it("每条样例含封面与结尾页", () => {
    for (const ex of examples) {
      const layouts = ex.slides.map((s) => s.layout);
      expect(layouts).toContain("cover");
      expect(layouts).toContain("closing");
    }
  });

  it("每条样例都至少包含 1 个 chart 页", () => {
    for (const ex of examples) {
      const hasChart = ex.slides.some(
        (s) => s.layout === "chart" && Boolean(s.chart),
      );
      expect(hasChart, `样例 ${ex.id} 缺少 layout:"chart" 的图表页`).toBe(true);
    }
  });

  it("覆盖至少 5 种 (mode, visualStyle) 组合", () => {
    const combos = new Set(
      examples.map((ex) => `${ex.design.mode}+${ex.design.visualStyle}`),
    );
    expect(combos.size).toBeGreaterThanOrEqual(5);
  });
});
