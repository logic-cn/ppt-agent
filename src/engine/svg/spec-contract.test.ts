import { describe, it, expect } from "vitest";
import { validateSvgContract, SVG_CONTRACT } from "./spec-contract";

describe("validateSvgContract", () => {
  it("拒绝无 viewBox 的 svg", () => {
    const errs = validateSvgContract(`<svg><rect/></svg>`);
    expect(errs.length).toBeGreaterThan(0);
  });

  it("接受合规 svg", () => {
    const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="10" y="10" width="100" height="50" fill="#111"/></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });

  it("拒绝缺少 svg 根元素", () => {
    const errs = validateSvgContract(`<rect/>`);
    expect(errs.some((e) => e.message.includes("svg"))).toBe(true);
    expect(errs[0].code).toBe("svg.contractMissingRoot");
  });

  it("拒绝 viewBox 非 0 0 1280 720", () => {
    const errs = validateSvgContract(
      `<svg viewBox="0 0 800 600"><rect/></svg>`,
    );
    expect(errs.some((e) => e.message.includes("viewBox"))).toBe(true);
    expect(errs[0].code).toBe("svg.contractBadViewBox");
    expect(errs[0].params).toMatchObject({
      required: "0 0 1280 720",
      actual: "0 0 800 600",
    });
  });

  it("拒绝禁用元素 foreignObject", () => {
    const errs = validateSvgContract(
      `<svg viewBox="0 0 1280 720"><foreignObject/></svg>`,
    );
    expect(errs.some((e) => e.message.includes("foreignObject"))).toBe(true);
    expect(errs[0].code).toBe("svg.contractForbiddenElement");
    expect(errs[0].params).toMatchObject({ name: "foreignObject" });
  });

  it("拒绝 script 元素", () => {
    const errs = validateSvgContract(
      `<svg viewBox="0 0 1280 720"><script>alert(1)</script></svg>`,
    );
    expect(errs.some((e) => e.message.includes("script"))).toBe(true);
    expect(errs[0].code).toBe("svg.contractForbiddenElement");
  });

  it("拒绝外部引用 image href 非 data URI", () => {
    const errs = validateSvgContract(
      `<svg viewBox="0 0 1280 720"><image href="https://example.com/a.png"/></svg>`,
    );
    expect(
      errs.some(
        (e) => e.message.includes("外部") || e.message.includes("href"),
      ),
    ).toBe(true);
    expect(errs[0].code).toBe("svg.contractExternalRef");
    expect(errs[0].params).toMatchObject({ url: "https://example.com/a.png" });
  });

  it("接受 data URI 的 image", () => {
    const ok = `<svg viewBox="0 0 1280 720"><image href="data:image/png;base64,AAAA"/></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });

  it("拒绝未知元素", () => {
    const errs = validateSvgContract(
      `<svg viewBox="0 0 1280 720"><foo/></svg>`,
    );
    expect(errs.some((e) => e.message.includes("foo"))).toBe(true);
    expect(errs[0].code).toBe("svg.contractUnsupportedElement");
  });

  it("接受含 defs 与渐变定义的合法 svg", () => {
    const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#111"/><stop offset="100%" stop-color="#fff"/></linearGradient></defs><rect x="10" y="10" width="100" height="50" fill="url(#g1)"/></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
    expect(SVG_CONTRACT.allowedElements.has("defs")).toBe(true);
  });

  it("正文里的尖括号不被当成标签", () => {
    const ok = `<svg viewBox="0 0 1280 720"><text x="10" y="20">对比 &lt;b&gt; 与普通方案</text><text x="10" y="60">使用 &lt;script&gt; 会被拒绝</text></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });

  it("文本节点内的裸尖括号不被当成标签", () => {
    const ok = `<svg viewBox="0 0 1280 720"><text x="10" y="20">请使用 <b> 加粗强调</text></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });

  it("注释里的元素不被判定为标签", () => {
    const ok = `<svg viewBox="0 0 1280 720"><!-- <script>alert(1)</script> --><rect x="1" y="1" width="10" height="10"/></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });

  it("正文里的 href 文本不触发外部引用检查", () => {
    const ok = `<svg viewBox="0 0 1280 720"><text x="10" y="20">详见 href="https://example.com"</text></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });

  it("SVG_CONTRACT 暴露白名单与尺寸", () => {
    expect(SVG_CONTRACT.width).toBe(1280);
    expect(SVG_CONTRACT.height).toBe(720);
    expect(SVG_CONTRACT.allowedElements.has("rect")).toBe(true);
  });
});
