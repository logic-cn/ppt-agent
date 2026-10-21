import { describe, it, expect } from "vitest";
import {
  estimateTextWidthPx,
  maxCharsPerLine,
  blockCapacity,
  wrapTextToWidth,
  renderFittedText,
  escapeXmlText,
} from "./text-measure";

describe("estimateTextWidthPx 口径", () => {
  it("CJK 按 1.0em + 0.4em 尾距", () => {
    expect(estimateTextWidthPx("市场", 44)).toBeCloseTo(44 * 2 + 17.6, 5);
  });
  it("拉丁按 0.55em", () => {
    expect(estimateTextWidthPx("ab", 40)).toBeCloseTo(40 * 0.55 * 2 + 16, 5);
  });
});

describe("maxCharsPerLine / blockCapacity", () => {
  it("1200px 宽 44px 字号 → 每行 26 字", () => {
    expect(maxCharsPerLine(1200, 44)).toBe(26);
  });
  it("非法输入归零", () => {
    expect(maxCharsPerLine(0, 24)).toBe(0);
    expect(maxCharsPerLine(100, 0)).toBe(0);
  });
  it("容量 = 每行字数 × 可容纳行数", () => {
    const cap = blockCapacity(1144, 120, 24);
    expect(cap.perLine).toBe(47);
    expect(cap.lines).toBe(3);
    expect(cap.totalChars).toBe(141);
  });
});

describe("wrapTextToWidth", () => {
  it("CJK 逐字断行，不超宽", () => {
    const lines = wrapTextToWidth("一二三四五六七八九十", 24, 130);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      // 每行纯字形宽不超上限
      expect(estimateTextWidthPx(l, 24)).toBeLessThanOrEqual(
        130 + 24 * 0.4 + 0.001,
      );
    }
  });
  it("拉丁按词断，不切单词", () => {
    const lines = wrapTextToWidth("alpha beta gamma", 20, 100);
    expect(lines).toEqual(["alpha", "beta", "gamma"]);
  });
  it("拉丁词组合不超宽", () => {
    const lines = wrapTextToWidth("hello world", 20, 400);
    expect(lines).toEqual(["hello world"]);
  });
  it("显式换行符保留断行", () => {
    expect(wrapTextToWidth("a\nb", 20, 500)).toEqual(["a", "b"]);
  });
});

describe("renderFittedText", () => {
  const box = { x: 40, y: 100, w: 200, h: 60 };
  it("单行输出一个 text 节点，基线 = y + 字号", () => {
    const out = renderFittedText(box, 24, "短标题");
    expect(out).toContain('y="124"');
    expect(out.match(/<tspan/g)).toBeNull();
  });
  it("多行用 tspan，首行 dy=0、行距 1.2em", () => {
    const out = renderFittedText(
      box,
      24,
      "这是一段超过盒子宽度需要换行的较长中文文本",
    );
    const tspans = out.match(/<tspan/g) ?? [];
    expect(tspans.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain('dy="29"');
  });
  it("超出盒高截断行数", () => {
    const out = renderFittedText(box, 24, "字".repeat(200));
    const tspans = out.match(/<tspan/g) ?? [];
    expect(tspans.length).toBeLessThanOrEqual(Math.floor(60 / (24 * 1.2)) + 1);
  });
  it("文本内容做 XML 转义", () => {
    const out = renderFittedText(box, 24, "A&B <tag>");
    expect(out).toContain("A&amp;B &lt;tag&gt;");
    expect(escapeXmlText("\"'")).toContain("&quot;");
  });
});
