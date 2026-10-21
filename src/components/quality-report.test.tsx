import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QualityReport } from "./quality-report";
import { useSettingsStore } from "@/store/settings";
import type { QualityFinding } from "@/services/quality";

const finding: QualityFinding = {
  rule: "svg_aesthetics",
  severity: "soft",
  message: "对比度不足：文字（#111111）与其底面（#EEEEEE）对比度 1.20 < 4.5",
  code: "svg.aestheticsLowContrast",
  params: { fg: "111111", bg: "EEEEEE", ratio: "1.20", min: 4.5 },
  page: { index: 3, title: "市场分析" },
  autoFixable: false,
};

describe("QualityReport 文案本地化", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
  });

  it("中文界面展示中文诊断", () => {
    render(<QualityReport findings={[finding]} />);
    expect(screen.getByText(/对比度不足/)).toBeTruthy();
    expect(screen.getByText(/第 3 页「市场分析」/)).toBeTruthy();
  });

  it("切到英文界面后展示英文诊断与英文页面前缀", () => {
    useSettingsStore.getState().setLang("en");
    render(<QualityReport findings={[finding]} />);
    expect(screen.getByText(/Contrast too low/)).toBeTruthy();
    expect(screen.getByText(/Page 3/)).toBeTruthy();
  });
});
