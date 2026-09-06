// 内置图标词表测试（C1）：配方展开 / 幂等 / 校验 / 与预设形状协同
import { describe, it, expect } from "vitest";
import { ICONS, isIcon, finalizeSvgIcons, ICON_VOCAB_PROMPT } from "./icons";
import { finalizeSvgPresets } from "./presets";
import { checkSvgIcons } from "./quality/checker";
import { checkSvg } from "./quality/checker";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

const spec = buildSpecLock(DEFAULT_DESIGN);

describe("ICONS 词表", () => {
  it("16 个图标，id 全部可作为标记值", () => {
    expect(Object.keys(ICONS)).toHaveLength(16);
    for (const id of Object.keys(ICONS)) expect(isIcon(id)).toBe(true);
    expect(isIcon("rocket")).toBe(false);
  });

  it("词汇表提示词包含全部图标与用法示例", () => {
    for (const id of Object.keys(ICONS)) {
      expect(ICON_VOCAB_PROMPT).toContain(id);
    }
    expect(ICON_VOCAB_PROMPT).toContain("<rect data-icon=");
  });
});

describe("finalizeSvgIcons", () => {
  it("把 rect 载体展开为图标配方的形状序列（绝对坐标，落在 bbox 内）", () => {
    const out = finalizeSvgIcons(
      '<svg><rect x="100" y="60" width="48" height="48" data-icon="clock" fill="#1D4ED8"/></svg>',
    );
    expect(out).not.toContain("data-icon");
    expect(out).toContain("<circle");
    expect(out).toContain("<line");
    // 表盘圆心落在 bbox 内：100+24=124
    expect(out).toMatch(/cx="124"/);
    // 颜色透传（clock 为线框图标，走 stroke）
    expect(out).toContain('stroke="#1D4ED8"');
  });

  it("展开产物通过质量契约与越界校验", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="40" y="40" width="48" height="48" data-icon="check" fill="#1D4ED8"/></svg>';
    const out = finalizeSvgIcons(svg);
    expect(
      checkSvg(out, spec).filter((i) => i.severity === "error"),
    ).toHaveLength(0);
  });

  it("幂等：展开产物不再被二次展开", () => {
    const once = finalizeSvgIcons(
      '<svg><rect x="0" y="0" width="48" height="48" data-icon="chartBar" fill="#111827"/></svg>',
    );
    expect(finalizeSvgIcons(once)).toBe(once);
  });

  it("未知图标 id 原样保留（交由 checkSvgIcons 报错重画）", () => {
    const svg =
      '<svg><rect x="0" y="0" width="24" height="24" data-icon="rocket" fill="#000000"/></svg>';
    expect(finalizeSvgIcons(svg)).toBe(svg);
  });

  it("与预设形状词表协同：home 图标的三角部件走 data-prst 原生映射", () => {
    const out = finalizeSvgPresets(
      finalizeSvgIcons(
        '<svg><rect x="10" y="10" width="48" height="48" data-icon="home" fill="#1D4ED8"/></svg>',
      ),
    );
    expect(out).toContain('data-prst="triangle"');
    expect(out).toContain("<path");
  });
});

describe("checkSvgIcons", () => {
  it("未知 data-icon 报 error 并列出图标库", () => {
    const issues = checkSvgIcons('<svg><rect data-icon="rocket"/></svg>');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("check");
  });

  it("合法 data-icon 不报错", () => {
    expect(checkSvgIcons('<svg><rect data-icon="pin"/></svg>')).toHaveLength(0);
  });
});
