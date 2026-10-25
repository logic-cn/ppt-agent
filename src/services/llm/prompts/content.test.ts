import { describe, it, expect } from "vitest";
import { buildContentSystemPrompt } from "./content";
import type { DesignLock } from "../../../types/design";

const DESIGN: DesignLock = {
  mode: "briefing",
  visualStyle: "soft-rounded",
  palette: "business-blue",
};

describe("buildContentSystemPrompt", () => {
  it("注入 DesignLock 的视觉风格与配色 HEX", () => {
    const prompt = buildContentSystemPrompt(DESIGN);
    // 视觉风格 character
    expect(prompt).toContain("圆角卡片");
    // 7 个配色 HEX
    for (const hex of [
      "#2563EB",
      "#3B82F6",
      "#FBBF24",
      "#0C1929",
      "#1A2D42",
      "#F1F5F9",
      "#94A3B8",
    ]) {
      expect(prompt).toContain(hex);
    }
  });
});

describe("buildContentSystemPrompt 演讲备注", () => {
  it("要求每页产出 notes 讲稿并纳入返回格式", () => {
    const prompt = buildContentSystemPrompt(DESIGN);
    expect(prompt).toContain("notes");
    expect(prompt).toContain("演讲者备注");
  });
});
