import { describe, it, expect } from "vitest";
import { resolveTheme } from "./index";
import type { Theme } from "@/types/theme";

describe("resolveTheme 派生", () => {
  it("colors 来自 palette, fonts/spacing 来自 visualStyle", () => {
    const t: Theme = resolveTheme("business-blue", "swiss-minimal");
    expect(t.colors.primary).toBe("#60A5FA");
    expect(t.fonts.title).toContain("Source Han Sans");
    expect(t.spacing).toBe("airy");
  });
  it("未知 palette 兜底 DEFAULT_DESIGN.palette", () => {
    const t = resolveTheme("custom-ghost", "soft-rounded");
    expect(t.colors.primary).toBeDefined();
  });
  it("无 layouts 字段", () => {
    const t = resolveTheme("business-blue", "swiss-minimal");
    expect((t as unknown as { layouts?: unknown }).layouts).toBeUndefined();
  });
});
