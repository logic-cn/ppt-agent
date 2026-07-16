import { describe, it, expect } from "vitest";
import { buildSpecLock } from "./spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

describe("buildSpecLock", () => {
  it("由默认 design 产出画布/配色/字体", () => {
    const lock = buildSpecLock(DEFAULT_DESIGN);
    expect(lock.canvas).toEqual({ w: 1280, h: 720 });
    expect(lock.colors.primary).toMatch(/^#/);
    expect(lock.fonts.title).toContain("Han");
  });
});
