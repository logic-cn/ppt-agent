import { describe, it, expect } from "vitest";
import { getPalette, PALETTES } from "./palettes";

describe("palettes", () => {
  it("business-blue 返回含 7 个颜色字段的对象", () => {
    const palette = getPalette("business-blue");
    expect(palette).toBeDefined();
    const keys = Object.keys(palette!.colors).sort();
    expect(keys).toEqual(
      [
        "accent",
        "background",
        "primary",
        "secondary",
        "surface",
        "text",
        "textMuted",
      ].sort(),
    );
  });

  it("未知 id 返回 undefined", () => {
    expect(getPalette("not-exist")).toBeUndefined();
  });

  it("保留全部 4 套配色", () => {
    expect(PALETTES).toHaveLength(4);
  });
});
