import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUALITY_MESSAGE_KEYS,
  localizeFinding,
  localizeSvgIssue,
  qualityMessageKey,
} from "./message-i18n";
import { en } from "@/locales/en";
import { zh } from "@/locales/zh";
import type { QualityFinding } from "./deck-quality";

const SRC = join(process.cwd(), "src");

/** 产出诊断 code 的源文件：新增诊断必须在这里出现 code 字段 */
const CODE_SOURCES = [
  "engine/svg/quality/checker.ts",
  "engine/svg/spec-contract.ts",
  "engine/svg/executor.ts",
  "services/quality/deck-quality.ts",
  "services/generation/first-page-gate.ts",
];

function collectDeclaredCodes(): string[] {
  const codes = new Set<string>();
  for (const rel of CODE_SOURCES) {
    const src = readFileSync(join(SRC, rel), "utf8");
    // code 字段可能是字面量，也可能是三元表达式（brand/page 两分支）
    for (const m of src.matchAll(/code:[^\n]*$/gm)) {
      for (const lit of m[0].matchAll(/"((?:svg|deck)\.[\w]+)"/g)) {
        codes.add(lit[1]);
      }
    }
  }
  return [...codes];
}

const CJK = /[一-鿿]/;

describe("质量诊断 code ↔ locale 映射", () => {
  it("每条诊断 code 都登记了 locale key", () => {
    const declared = collectDeclaredCodes();
    expect(declared.length).toBeGreaterThan(30);
    const missing = declared.filter((c) => !QUALITY_MESSAGE_KEYS[c]);
    expect(missing).toEqual([]);
  });

  it("登记的 key 在中英两份 locale 里都存在且非空", () => {
    for (const [code, key] of Object.entries(QUALITY_MESSAGE_KEYS)) {
      expect(en[key], `en 缺少 ${code} → ${key}`).toBeTruthy();
      expect(zh[key], `zh 缺少 ${code} → ${key}`).toBeTruthy();
    }
  });

  it("locale key 一律为 quality.<code>", () => {
    for (const [code, key] of Object.entries(QUALITY_MESSAGE_KEYS)) {
      expect(key).toBe(`quality.${code}`);
    }
  });

  it("英文文案不含中文残留", () => {
    for (const [code, key] of Object.entries(QUALITY_MESSAGE_KEYS)) {
      expect(CJK.test(en[key]), `en 文案仍是中文: ${code}`).toBe(false);
    }
  });

  it("未知 code 返回 undefined（调用方回落中文文案）", () => {
    expect(qualityMessageKey("nope.notExist")).toBeUndefined();
    expect(qualityMessageKey(undefined)).toBeUndefined();
  });
});

describe("localizeFinding", () => {
  const finding: QualityFinding = {
    rule: "svg_aesthetics",
    severity: "soft",
    message:
      "对比度不足：文字（#111111）与其底面（#EEEEEE）对比度 1.20 < 4.5——请改用配色表中对比更强的组合",
    code: "svg.aestheticsLowContrast",
    params: { fg: "111111", bg: "EEEEEE", ratio: "1.20", min: 4.5 },
    autoFixable: false,
  };

  it("英文界面渲染英文文案", () => {
    const out = localizeFinding(finding, "en");
    expect(CJK.test(out)).toBe(false);
    expect(out).toContain("Contrast too low");
    expect(out).toContain("#111111");
  });

  it("中文界面渲染中文文案", () => {
    const out = localizeFinding(finding, "zh");
    expect(out).toContain("对比度不足");
    expect(out).toContain("#111111");
  });

  it("无 code 时回落中文规范文案", () => {
    const legacy: QualityFinding = {
      rule: "x",
      severity: "soft",
      message: "旧文案",
      autoFixable: false,
    };
    expect(localizeFinding(legacy, "en")).toBe("旧文案");
  });

  it("页面前缀随语言渲染", () => {
    const withPage: QualityFinding = {
      ...finding,
      page: { index: 3, title: "市场分析" },
    };
    expect(localizeFinding(withPage, "zh")).toContain("第 3 页「市场分析」：");
    expect(localizeFinding(withPage, "en")).toContain("Page 3");
    expect(localizeFinding(withPage, "en")).toContain("市场分析");
  });
});

describe("localizeSvgIssue", () => {
  it("英文界面渲染英文文案", () => {
    const out = localizeSvgIssue(
      {
        severity: "error",
        message: "图表缺少数据：data-chart-data 未提供（bar 图将无法导出）",
        code: "svg.chartMissingData",
        params: { type: "bar" },
      },
      "en",
    );
    expect(CJK.test(out)).toBe(false);
    expect(out).toContain("bar");
  });

  it("无 code 时回落中文规范文案", () => {
    const out = localizeSvgIssue(
      { severity: "error", message: "原始中文" },
      "en",
    );
    expect(out).toBe("原始中文");
  });
});
