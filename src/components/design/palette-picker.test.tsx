import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PalettePicker } from "./PalettePicker";

describe("PalettePicker", () => {
  it("渲染内置配色名", () => {
    render(<PalettePicker value="business-blue" onChange={() => {}} />);
    expect(screen.getByText("商务深蓝")).toBeTruthy();
  });
  it("点击新建后显示颜色表单", () => {
    render(<PalettePicker value="business-blue" onChange={() => {}} />);
    fireEvent.click(screen.getByText("＋新建配色"));
    expect(screen.getByPlaceholderText("主色")).toBeTruthy();
  });
});
