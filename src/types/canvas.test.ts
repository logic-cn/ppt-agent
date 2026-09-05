// 画布格式注册表与 spec-lock 集成测试（B5）
import { describe, it, expect } from "vitest";
import {
  CANVAS_FORMATS,
  getCanvasFormat,
  canvasToInches,
  DEFAULT_CANVAS_FORMAT_ID,
} from "./canvas";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

describe("画布格式注册表", () => {
  it("包含 16:9 / 小红书 3:4 / 方图三种格式", () => {
    expect(CANVAS_FORMATS.map((f) => f.id)).toEqual([
      "ppt-16-9",
      "xhs-3-4",
      "square-1-1",
    ]);
  });

  it("未知/缺省 id 回落 16:9（历史 deck 兼容）", () => {
    expect(getCanvasFormat(undefined).id).toBe(DEFAULT_CANVAS_FORMAT_ID);
    expect(getCanvasFormat("banana").id).toBe("ppt-16-9");
    expect(getCanvasFormat("xhs-3-4")).toMatchObject({ w: 1080, h: 1440 });
  });

  it("像素 → 英寸 = 像素/96（16:9 即 13.333×7.5）", () => {
    const inches = canvasToInches(getCanvasFormat("ppt-16-9"));
    expect(inches.w).toBeCloseTo(13.3333, 3);
    expect(inches.h).toBeCloseTo(7.5, 3);
  });

  it("buildSpecLock 按格式派生画布，并在 SpecLock 记录格式 id", () => {
    const xhs = buildSpecLock({
      ...DEFAULT_DESIGN,
      canvasFormat: "xhs-3-4",
    });
    expect(xhs.canvas).toEqual({ w: 1080, h: 1440 });
    expect(xhs.canvasFormat).toBe("xhs-3-4");

    const defaultSpec = buildSpecLock(DEFAULT_DESIGN);
    expect(defaultSpec.canvas).toEqual({ w: 1280, h: 720 });
    expect(defaultSpec.canvasFormat).toBe("ppt-16-9");
  });
});
