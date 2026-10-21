// 预览原位编辑测试（E1）：stripPeIds / 画布交互 / 批注上下文
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { SvgEditorCanvas, stripPeIds } from "./svg-editor-canvas";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/>
  <text x="100" y="120" font-size="40" fill="#111827">标题文字</text>
  <rect x="100" y="200" width="300" height="120" rx="12" fill="#1D4ED8"/>
</svg>`;

describe("stripPeIds", () => {
  it("剥离临时 data-pe-id 标记", () => {
    const tagged =
      '<svg><rect data-pe-id="pe-1" x="0"/><text data-pe-id="pe-2">t</text></svg>';
    expect(stripPeIds(tagged)).toBe('<svg><rect x="0"/><text>t</text></svg>');
  });
});

describe("SvgEditorCanvas", () => {
  it("点击 text 元素选中并显示 mini-inspector 字段", async () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <SvgEditorCanvas svg={SVG} onUpdate={onUpdate} />,
    );
    const host = container.querySelector("[data-pe-canvas]")!;
    await waitFor(() => {
      expect(host.querySelector("svg")).toBeTruthy();
    });
    const text = host.querySelector("text")!;
    // 对目标元素触发（target 是 Event 只读属性，fireEvent 不能指定），
    // 事件冒泡到画布 host，hitTest 从 e.target 沿祖先找
    fireEvent.pointerDown(text, { button: 0, clientX: 120, clientY: 110 });
    await waitFor(() => {
      expect(container.querySelector("[data-pe-inspector]")).toBeTruthy();
    });
    // 文字/字号字段出现且带默认值
    expect(
      (container.querySelector("[data-pe-inspector] input") as HTMLInputElement)
        .value,
    ).toBe("标题文字");
  });

  it("修改文字内容后 onBlur 触发确定性写回（无临时 id 落库）", async () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <SvgEditorCanvas svg={SVG} onUpdate={onUpdate} />,
    );
    const host = container.querySelector("[data-pe-canvas]")!;
    await waitFor(() => {
      expect(host.querySelector("svg")).toBeTruthy();
    });
    const text = host.querySelector("text")!;
    fireEvent.pointerDown(text, { button: 0, clientX: 120, clientY: 110 });
    await waitFor(() => {
      expect(container.querySelector("[data-pe-inspector]")).toBeTruthy();
    });
    const input = container.querySelector(
      "[data-pe-inspector] input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "新标题" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
    const written = onUpdate.mock.calls[0][0] as string;
    expect(written).toContain("新标题");
    expect(written).not.toContain("data-pe-id");
    // 其余元素保留
    expect(written).toContain("#1D4ED8");
  });

  it("方向键微调写入 translate 并在静默后提交", async () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <SvgEditorCanvas svg={SVG} onUpdate={onUpdate} />,
    );
    const host = container.querySelector("[data-pe-canvas]")!;
    await waitFor(() => {
      expect(host.querySelector("svg")).toBeTruthy();
    });
    const text = host.querySelector("text")!;
    fireEvent.pointerDown(text, { button: 0, clientX: 120, clientY: 110 });
    await waitFor(() => {
      expect(container.querySelector("[data-pe-inspector]")).toBeTruthy();
    });
    fireEvent.keyDown(host, { key: "ArrowRight" });
    fireEvent.keyDown(host, { key: "ArrowRight" });
    await waitFor(() => {
      expect(text.getAttribute("transform")).toContain("translate(2");
    });
    // 400ms 微调静默合并窗口过后提交
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  }, 5000);

  it("onAnnotate 收到携带 markup 的元素上下文", async () => {
    const onAnnotate = vi.fn();
    const { container } = render(
      <SvgEditorCanvas svg={SVG} onUpdate={vi.fn()} onAnnotate={onAnnotate} />,
    );
    const host = container.querySelector("[data-pe-canvas]")!;
    await waitFor(() => {
      expect(host.querySelector("svg")).toBeTruthy();
    });
    const text = host.querySelector("text")!;
    fireEvent.pointerDown(text, { button: 0, clientX: 120, clientY: 110 });
    await waitFor(() => {
      expect(container.querySelector("[data-pe-inspector]")).toBeTruthy();
    });
    const input = container.querySelector(
      '[data-pe-inspector] form input[name="instruction"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "把这段文字放大加粗" } });
    fireEvent.submit(input.closest("form")!);
    expect(onAnnotate).toHaveBeenCalledWith(
      "把这段文字放大加粗",
      expect.objectContaining({
        tag: "text",
        text: "标题文字",
        markup: expect.stringContaining("标题文字"),
      }),
    );
    expect(onAnnotate.mock.calls[0][1].markup).not.toContain("data-pe-id");
  });

  it("非法 SVG 输入不崩溃（空白画布）", () => {
    const { container } = render(
      <SvgEditorCanvas svg="not an svg" onUpdate={vi.fn()} />,
    );
    expect(container.querySelector("[data-pe-canvas]")!.children.length).toBe(
      0,
    );
  });
});
