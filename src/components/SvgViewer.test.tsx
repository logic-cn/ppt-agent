import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SvgViewer } from "./SvgViewer";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="10" y="10" width="300" height="120" fill="#111"/><text x="40" y="60" font-size="32" fill="#fff">标题</text></svg>`;

describe("SvgViewer", () => {
  it("将 svg 字符串渲染为容器内的 <svg> 元素", () => {
    render(<SvgViewer svg={SAMPLE_SVG} />);
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("容器内 svg 的 viewBox 为 0 0 1280 720", () => {
    render(<SvgViewer svg={SAMPLE_SVG} />);
    const svg = document.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 1280 720");
  });

  it("容器保持 16:9 比例（aspect-ratio 样式存在）", () => {
    const { container } = render(<SvgViewer svg={SAMPLE_SVG} />);
    const wrapper = container.querySelector("[data-svg-viewer]")!;
    expect(wrapper.getAttribute("style")).toContain("aspect-ratio: 16 / 9");
  });

  it("支持可选 className", () => {
    const { container } = render(
      <SvgViewer svg={SAMPLE_SVG} className="my-class" />,
    );
    const wrapper = container.querySelector("[data-svg-viewer]")!;
    expect(wrapper.className).toContain("my-class");
  });
});
