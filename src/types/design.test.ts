import { describe, it, expect } from "vitest";
import { isDesignLock, NARRATIVE_MODE_IDS, VISUAL_STYLE_IDS } from "./design";

describe("isDesignLock", () => {
  it("接受合法 DesignLock", () => {
    const d = {
      mode: "pyramid",
      visualStyle: "swiss-minimal",
      palette: "business-blue",
    };
    expect(isDesignLock(d)).toBe(true);
  });
  it("拒绝未知 mode", () => {
    const d = {
      mode: "foo",
      visualStyle: "swiss-minimal",
      palette: "business-blue",
    };
    expect(isDesignLock(d)).toBe(false);
  });
  it("mode 枚举覆盖 5+1", () => {
    expect(NARRATIVE_MODE_IDS).toEqual(
      expect.arrayContaining([
        "pyramid",
        "narrative",
        "instructional",
        "showcase",
        "briefing",
        "custom",
      ]),
    );
  });
  it("visualStyle 枚举覆盖 6 种", () => {
    expect(VISUAL_STYLE_IDS).toEqual(
      expect.arrayContaining([
        "swiss-minimal",
        "dark-tech",
        "soft-rounded",
        "editorial",
        "blueprint",
        "glassmorphism",
      ]),
    );
  });
});
