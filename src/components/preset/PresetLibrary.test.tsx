import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PresetLibrary } from "./PresetLibrary";
import { getPresetById } from "@/presets";

describe("PresetLibrary 模板信息展示", () => {
  it("展示模板名、页数、适用场景与适用对象", () => {
    render(<PresetLibrary onPick={() => {}} />);

    const preset = getPresetById("quarterly-review")!;
    expect(screen.getByText(preset.name)).toBeTruthy();
    // 页数（可能有多个模板同页数，取其一即可）
    expect(
      screen.getAllByText(`${preset.slides.length} 页`).length,
    ).toBeGreaterThan(0);
    // 适用场景（多个模板可能同场景）
    expect(screen.getAllByText("业务复盘").length).toBeGreaterThan(0);
    // 适用对象
    expect(screen.getByText(`面向 ${preset.audience}`)).toBeTruthy();
  });

  it("画廊示例（无场景元数据）不渲染空徽章", () => {
    render(<PresetLibrary onPick={() => {}} />);
    // 画廊示例没有 audience，不应出现 "面向 undefined"
    expect(screen.queryByText(/面向\s*undefined/)).toBeNull();
  });
});
