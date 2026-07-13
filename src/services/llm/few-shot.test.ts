import { describe, it, expect } from "vitest";
import { selectFewShot, buildFewShotPrompt } from "./few-shot";
import type { DesignLock } from "../../types/design";

const design: DesignLock = {
  mode: "pyramid",
  visualStyle: "swiss-minimal",
  palette: "business-blue",
};

describe("selectFewShot", () => {
  it("优先返回风格最匹配的示例", () => {
    const result = selectFewShot(design);
    expect(result[0].id).toBe("quarterly-pyramid-swiss");
  });

  it("最多返回 2 条", () => {
    const result = selectFewShot(design);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

describe("buildFewShotPrompt", () => {
  it("输出包含 slides 的精简 JSON", () => {
    const examples = selectFewShot(design);
    const prompt = buildFewShotPrompt(examples);
    expect(prompt).toContain("layout");
    expect(prompt).toContain("title");
  });

  it("不包含 full content 长文本", () => {
    const examples = selectFewShot(design);
    const prompt = buildFewShotPrompt(examples);
    expect(prompt).not.toContain("复购贡献 60% 的营收增长");
  });

  it("空示例返回空串", () => {
    expect(buildFewShotPrompt([])).toBe("");
  });
});
