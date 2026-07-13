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

  it("至少有一条样例包含 chart", () => {
    const withChart = examples.filter((ex) =>
      ex.slides.some((s) => Boolean(s.chart)),
    );
    expect(withChart.length).toBeGreaterThanOrEqual(1);
  });

  it("覆盖至少 5 种 (mode, visualStyle) 组合", () => {
    const combos = new Set(
      examples.map((ex) => `${ex.design.mode}+${ex.design.visualStyle}`),
    );
    expect(combos.size).toBeGreaterThanOrEqual(5);
  });
});
