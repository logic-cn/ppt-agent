// 预设形状词表测试：路径生成 / 规范化 / 校验 / 导出映射
import { describe, it, expect } from "vitest";
import {
  PRESET_SHAPES,
  isPresetShape,
  finalizeSvgPresets,
  PRESET_VOCAB_PROMPT,
} from "./presets";
import { checkPresetShapes } from "./quality/checker";

describe("PRESET_SHAPES 路径生成", () => {
  it("全部形状 id 可作为 pptxgenjs ShapeType（与导出枚举对齐）", () => {
    // 词表 id 必须与 PowerPoint prst / pptxgenjs 枚举一致，导出端才能原生映射
    const known = new Set([
      "chevron",
      "homePlate",
      "rightArrow",
      "leftArrow",
      "upArrow",
      "downArrow",
      "triangle",
      "diamond",
      "hexagon",
      "trapezoid",
      "parallelogram",
      "star5",
      "flowChartTerminator",
    ]);
    expect(new Set(Object.keys(PRESET_SHAPES))).toEqual(known);
  });

  it("路径生成落在包围盒内且闭合", () => {
    for (const def of Object.values(PRESET_SHAPES)) {
      const d = def.path(200, 100);
      expect(d).toMatch(/Z$/);
      // 逐段解析：M/L 的参数是坐标对；A 段前 5 个参数（rx/ry/rot/large/sweep）非坐标
      const xs: number[] = [];
      const ys: number[] = [];
      for (const seg of d.match(/[MLA][^MLA]*/g) ?? []) {
        const cmd = seg[0].toUpperCase();
        const nums = (seg.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(
          Number,
        );
        if (cmd === "A") {
          xs.push(nums[5]);
          ys.push(nums[6]);
        } else {
          for (let i = 0; i + 1 < nums.length; i += 2) {
            xs.push(nums[i]);
            ys.push(nums[i + 1]);
          }
        }
      }
      expect(xs.length).toBeGreaterThan(1);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...xs)).toBeLessThanOrEqual(200.01);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...ys)).toBeLessThanOrEqual(100.01);
    }
  });

  it("isPresetShape 对未知值返回 false", () => {
    expect(isPresetShape("chevron")).toBe(true);
    expect(isPresetShape("bananaShape")).toBe(false);
  });
});

describe("finalizeSvgPresets", () => {
  it("把 rect 载体改写为 canonical path 并保留绘制属性", () => {
    const svg =
      '<svg><rect x="40" y="20" width="200" height="100" data-prst="chevron" fill="#1D4ED8" stroke="#0F172A" stroke-width="2"/></svg>';
    const out = finalizeSvgPresets(svg);
    expect(out).toContain("<path");
    expect(out).not.toContain("<rect");
    expect(out).toContain('data-prst="chevron"');
    expect(out).toContain('fill="#1D4ED8"');
    expect(out).toContain('stroke="#0F172A"');
    expect(out).toContain('stroke-width="2"');
    // 路径坐标平移到 (40,20)
    expect(out).toMatch(/d="M40,20L/);
  });

  it("幂等：已规范化的 path 不再改写", () => {
    const once = finalizeSvgPresets(
      '<svg><rect x="0" y="0" width="100" height="50" data-prst="diamond" fill="#111827"/></svg>',
    );
    const twice = finalizeSvgPresets(once);
    expect(twice).toBe(once);
  });

  it("未知 prst 与普通 rect 原样保留", () => {
    const svg =
      '<svg><rect x="0" y="0" width="10" height="10" data-prst="banana"/><rect x="0" y="0" width="10" height="10" fill="#FFFFFF"/></svg>';
    expect(finalizeSvgPresets(svg)).toBe(svg);
  });
});

describe("checkPresetShapes", () => {
  it("未知 data-prst 报 error 并列出支持列表", () => {
    const issues = checkPresetShapes('<svg><rect data-prst="banana"/></svg>');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("chevron");
  });

  it("合法 data-prst 不报错", () => {
    expect(
      checkPresetShapes('<svg><path data-prst="star5"/></svg>'),
    ).toHaveLength(0);
  });
});

describe("PRESET_VOCAB_PROMPT", () => {
  it("词汇表提示词包含全部形状与用法示例", () => {
    for (const id of Object.keys(PRESET_SHAPES)) {
      expect(PRESET_VOCAB_PROMPT).toContain(id);
    }
    expect(PRESET_VOCAB_PROMPT).toContain("<rect data-prst=");
  });
});
