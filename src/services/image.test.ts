import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "./image";

describe("buildImagePrompt", () => {
  it("注入视觉风格与配色，不含随机风格词", () => {
    const prompt = buildImagePrompt("产品图", {
      mode: "briefing",
      visualStyle: "swiss-minimal",
      palette: "business-blue",
    });
    expect(prompt).toContain("minimalist-swiss");
    expect(prompt).toContain("#60A5FA");
    expect(prompt).not.toContain("digital-dashboard");
    expect(prompt).not.toContain("glassmorphism");
  });
});
