import { describe, it, expect } from "vitest";
import { compactSvgOutput } from "./compact";

describe("compactSvgOutput（对标 compact_svg_coordinates/styles）", () => {
  it("坐标属性小数取整", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><rect x="40.53" y="12.4" width="600.9" height="80.1" fill="#FFF"/></svg>`,
    );
    expect(out).toContain('x="41"');
    expect(out).toContain('y="12"');
    expect(out).toContain('width="601"');
    expect(out).toContain('height="80"');
  });

  it("data-chart-x 等带前缀属性不被误改", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><g data-chart-x="40.5"><rect x="40.5" y="10" width="10" height="10"/></g></svg>`,
    );
    expect(out).toContain('data-chart-x="40.5"');
    expect(out).toContain('x="41"');
  });

  it("path d 与 points 内数字取整", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><path d="M 10.6 20.4 L 30.2 40.8 Z"/><polygon points="5.4,6.6 15.5,6.4"/></svg>`,
    );
    expect(out).toContain('d="M 11 20 L 30 41 Z"');
    expect(out).toContain('points="5,7 16,6"');
  });

  it("去注释、折叠标签间空白；viewBox 精确串不动", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><!-- 装饰 -->\n  <rect x="0" y="0" width="10" height="10" fill="#FFF"/>\n</svg>`,
    );
    expect(out).not.toContain("装饰");
    expect(out).toContain("><rect");
    expect(out).not.toMatch(/>\s+<rect/);
    expect(out).toContain('viewBox="0 0 1280 720"');
  });

  it("font-size 小数保留语义（不在取整白名单则原样）", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><text x="0" y="0" font-size="18.5">字</text></svg>`,
    );
    // font-size 不在 NUM_ATTRS：小数保留，不做风险改写
    expect(out).toContain('font-size="18.5"');
  });

  it("transform translate 小数取整", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><g transform="translate(12.6, 34.4)"><rect x="0" y="0" width="5" height="5"/></g></svg>`,
    );
    expect(out).toContain("translate(13, 34)");
  });
});

describe("compact 修复回归", () => {
  it("发丝线小数保留（height 0.4 不归零），text 内双空格不被吞", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><rect x="100" y="300" width="1080" height="0.4" fill="#94A3B8"/><text x="80" y="200" font-size="20">保留  双空格</text></svg>`,
    );
    expect(out).toContain('height="0.4"');
    expect(out).toContain("保留  双空格");
  });

  it("transform scale 因子不被取整归零", () => {
    const out = compactSvgOutput(
      `<svg viewBox="0 0 1280 720"><g transform="scale(0.4)"><rect x="0" y="0" width="5" height="5"/></g></svg>`,
    );
    expect(out).toContain("scale(0.4)");
  });
});
