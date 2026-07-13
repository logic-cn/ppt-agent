import { describe, it, expect } from "vitest";
import { getVisualStyle, VISUAL_STYLES } from "./visual-styles";

describe("visual-styles", () => {
  it("返回 swiss-minimal 且 cornerRadius 为 0", () => {
    const s = getVisualStyle("swiss-minimal");
    expect(s).toBeDefined();
    expect(s?.decoration.cornerRadius).toBe(0);
  });

  it("pairedImageRendering 为字符串", () => {
    const s = getVisualStyle("glassmorphism");
    expect(typeof s?.pairedImageRendering).toBe("string");
  });

  it("未知 id 返回 undefined", () => {
    expect(getVisualStyle("not-exist")).toBeUndefined();
  });

  it("包含 6 个视觉风格且无 HEX 颜色", () => {
    expect(VISUAL_STYLES).toHaveLength(6);
    for (const s of VISUAL_STYLES) {
      expect(s.character).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
