import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./button";
import { IconButton } from "./icon-button";

describe("Button", () => {
  it("加载态自动禁用并标记 aria-busy", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        导出
      </Button>,
    );
    const button = screen.getByRole("button", { name: "导出" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("显式 disabled 时不触发点击", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        删除
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("label 同时写入 aria-label 与 title", () => {
    const onClick = vi.fn();
    render(
      <IconButton
        label="返回首页"
        onClick={onClick}
        icon={<span aria-hidden="true">←</span>}
      />,
    );
    const button = screen.getByRole("button", { name: "返回首页" });
    expect(button.getAttribute("aria-label")).toBe("返回首页");
    expect(button.getAttribute("title")).toBe("返回首页");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
