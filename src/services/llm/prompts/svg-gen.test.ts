// svg-gen 提示词结构测试：分层注入（角色指引/设备菜单/几何对照/条件模块）
import { describe, it, expect } from "vitest";
import { buildSvgGenPrompt, DEVICE_MENU } from "./svg-gen";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";

const SPEC: SpecLock = {
  canvas: { w: 1280, h: 720 },
  colors: {
    primary: "#1D4ED8",
    secondary: "#3B82F6",
    accent: "#F59E0B",
    background: "#FFFFFF",
    surface: "#F3F4F6",
    text: "#111827",
    textMuted: "#6B7280",
  },
  fonts: { title: "Noto Sans SC", body: "Noto Sans SC" },
  style: "soft-rounded",
  icons: [],
};

function plan(overrides: Partial<PagePlanItem> = {}): PagePlanItem {
  return {
    role: "content",
    title: "市场规模与增速",
    intent: "说明市场规模与增长动力",
    bullets: ["市场规模 970 亿美元", "近三年 CAGR 18%"],
    ...overrides,
  };
}

describe("buildSvgGenPrompt 分层结构", () => {
  it("基础契约 + 设备菜单始终注入；无骨架角色（封面）走通用几何对照", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan({ role: "cover", bullets: undefined }),
      pageIndex: 0,
      totalPages: 6,
    });
    expect(prompt).toContain('viewBox="0 0 1280 720"');
    expect(prompt).toContain("#1D4ED8");
    expect(prompt).toContain(DEVICE_MENU.split("\n")[0]);
    expect(prompt).toContain("版式几何对照");
    expect(prompt).toContain("对称比较：1:1 双栏");
  });

  it("骨架角色注入确定性版式骨架（坐标 + 字数预算），取代通用几何对照", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan(),
      pageIndex: 0,
      totalPages: 6,
    });
    expect(prompt).toContain("本页版式骨架");
    expect(prompt).toContain("标题带（内容：「市场规模与增速」）");
    expect(prompt).toContain("每行最多");
    expect(prompt).not.toContain("版式几何对照");
  });

  it("comparison 骨架给出等宽双栏坐标与栏目标题预算", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan({
        role: "comparison",
        title: "自建 vs 采购",
        bullets: ["成本可控", "上线快", "团队专注核心", "供应商承担运维"],
      }),
      pageIndex: 1,
      totalPages: 6,
    });
    expect(prompt).toContain("两栏等宽");
    expect(prompt).toContain("栏目标题");
  });

  it("metrics 骨架给出 KPI 卡坐标", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan({ role: "metrics", bullets: ["970 亿美元", "18% CAGR"] }),
      pageIndex: 2,
      totalPages: 6,
    });
    expect(prompt).toContain("KPI 卡");
  });

  it("按角色注入对应版式指引", () => {
    const metrics = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan({ role: "metrics", title: "核心指标" }),
      pageIndex: 1,
      totalPages: 6,
    });
    expect(metrics).toContain("唯一视觉焦点");

    const timeline = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan({ role: "timeline", title: "发展阶段" }),
      pageIndex: 2,
      totalPages: 6,
    });
    expect(timeline).toContain("等距节点");
  });

  it("图表页注入 data-chart 约定，非图表页不注入", () => {
    const withChart = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan({ chartType: "bar" }),
      pageIndex: 0,
      totalPages: 6,
    });
    expect(withChart).toContain('data-chart-type="bar"');

    const without = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan(),
      pageIndex: 0,
      totalPages: 6,
    });
    expect(without).not.toContain("data-chart-type");
  });

  it("extraGuidance 作为全 deck 一致性要求注入", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan(),
      pageIndex: 3,
      totalPages: 6,
      extraGuidance: "1. 只允许使用配色表中的颜色。",
    });
    expect(prompt).toContain("全 deck 一致性要求");
    expect(prompt).toContain("只允许使用配色表中的颜色");
  });

  it("contentBrief 与 instruction 块保留原有行为", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: plan(),
      pageIndex: 0,
      totalPages: 6,
      contentBrief: "必须出现：970 亿美元",
      instruction: "把标题放大",
    });
    expect(prompt).toContain("本页内容素材");
    expect(prompt).toContain("必须出现：970 亿美元");
    expect(prompt).toContain("定向修改要求");
    expect(prompt).toContain("把标题放大");
  });

  it("slim 本地档：删设备菜单、词汇表截断到前 6 条，保留契约与版式骨架", () => {
    const base = {
      specLock: SPEC,
      plan: plan(),
      pageIndex: 0,
      totalPages: 6,
    };
    const full = buildSvgGenPrompt(base);
    const slim = buildSvgGenPrompt({ ...base, slim: true });
    expect(slim).not.toContain(DEVICE_MENU.split("\n")[0]);
    expect(slim).toContain("预设形状词汇表");
    expect(slim).toContain("内置图标词汇表");
    expect(slim).toContain("本页版式骨架");
    expect(slim).toContain("#1D4ED8");
    // 截断后总长应显著缩短
    expect(slim.length).toBeLessThan(full.length - 500);
    const vocabLineCount = (text: string) =>
      text.split("\n").filter((l) => l.startsWith("- ") && l.includes("："))
        .length;
    expect(vocabLineCount(slim)).toBeLessThan(vocabLineCount(full));
  });
});

describe("buildSvgGenPrompt 跨页版式轮换", () => {
  const many = {
    role: "content" as const,
    title: "增长动力",
    intent: "说明动力",
    bullets: ["甲要点", "乙要点", "丙要点", "丁要点", "戊要点"],
  };

  it("layoutVariant=1 注入双栏骨架与多样性提示", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: many,
      pageIndex: 3,
      totalPages: 8,
      layoutVariant: 1,
    });
    expect(prompt).toContain("双栏");
    expect(prompt).toContain("避免雷同");
  });

  it("layoutVariant 缺省（=0）不出现双栏提示", () => {
    const prompt = buildSvgGenPrompt({
      specLock: SPEC,
      plan: many,
      pageIndex: 2,
      totalPages: 8,
    });
    expect(prompt).not.toContain("避免雷同");
  });
});
