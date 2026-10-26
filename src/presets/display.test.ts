import { describe, expect, it } from "vitest";
import type { DeckPreset } from "@/types/preset";
import { getPresets } from "./index";
import { getPresetDisplay } from "./display";

describe("getPresetDisplay", () => {
  it("模板名称/描述/受众按语言切换", () => {
    const preset = getPresets().find((p) => p.id === "quarterly-review")!;
    const en = getPresetDisplay(preset, "en");
    expect(en.name).toBe("Quarterly Business Review");
    expect(en.description).toContain("management-facing");
    expect(en.audience).toBe("Management");

    const zh = getPresetDisplay(preset, "zh");
    expect(zh.name).toBe("季度业务复盘");
    expect(zh.audience).toBe("管理层");
  });

  it("示例名称按语言切换", () => {
    const example = getPresets().find(
      (p) => p.id === "quarterly-pyramid-swiss",
    )!;
    expect(getPresetDisplay(example, "en").name).toContain("Quarterly Review");
    expect(getPresetDisplay(example, "zh").name).toContain("季度复盘");
  });

  it("缺少 locale key 时回退到内置文案", () => {
    const custom: DeckPreset = {
      id: "custom-pack",
      name: "自定义模板",
      description: "自定义描述",
      audience: "团队",
      design: { mode: "briefing", visualStyle: "soft-rounded", palette: "x" },
      slides: [],
    };
    expect(getPresetDisplay(custom, "en")).toEqual({
      name: "自定义模板",
      description: "自定义描述",
      audience: "团队",
    });
  });
});
