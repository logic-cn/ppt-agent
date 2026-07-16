import { describe, it, expect } from "vitest";
import { checkSvg } from "./checker";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

const specLock = buildSpecLock(DEFAULT_DESIGN);

const VALID_VIEWBOX = `viewBox="0 0 1280 720"`;

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${VALID_VIEWBOX}>${inner}</svg>`;
}

describe("checkSvg", () => {
  it("rect 超出右边界（x+width > 1280）报 error", () => {
    const svg = wrap(
      `<rect x="1200" y="100" width="200" height="50" fill="#111"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /右边界|超出|越界/.test(e.message))).toBe(true);
  });

  it("text 越界报 error", () => {
    const svg = wrap(
      `<text x="1300" y="100" font-size="24" fill="#000">hello</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("合法 svg 返回空数组或仅 warn", () => {
    const svg = wrap(
      `<rect x="10" y="10" width="100" height="50" fill="#111"/><text x="20" y="40" font-size="16" fill="#000">标题</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });
});
