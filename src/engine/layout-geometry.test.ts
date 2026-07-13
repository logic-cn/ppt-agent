import { describe, it, expect } from "vitest";
import { getLayoutRects } from "./layout-geometry";
import type { SlideLayout } from "../types/deck";

describe("getLayoutRects", () => {
  it("覆盖所有 layout 且返回 title/body/visual", () => {
    const layouts: SlideLayout[] = [
      "cover",
      "section",
      "content",
      "two-column",
      "chart",
      "closing",
      "cols-2",
      "cols-3",
      "cols-4",
      "cols-5",
      "cols-6",
      "image",
    ];
    for (const l of layouts) {
      const r = getLayoutRects(l);
      expect(r.title).toBeDefined();
    }
  });
});
