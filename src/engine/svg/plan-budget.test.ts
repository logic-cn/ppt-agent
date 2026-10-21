import { describe, it, expect } from "vitest";
import {
  BASE_SVG_BUDGET_CHARS,
  PLAN_FIELD_BUDGET,
  clipBaseSvg,
  clipText,
  sanitizePlanForPrompt,
} from "./plan-budget";
import type { PagePlanItem } from "@/types/page-plan";

const plan: PagePlanItem = {
  role: "content",
  title: "关键抓手二——数据治理",
  intent: "说明数据治理在企业 AI 落地中的关键地位",
  bullets: ["数据资产盘点", "血缘与质量监控"],
  quote: "原文引用",
  attribution: "来源：第七章",
};

describe("clipText", () => {
  it("短文本原样返回", () => {
    expect(clipText("数据治理", 10)).toBe("数据治理");
  });

  it("超长文本截断并以省略号收尾", () => {
    const out = clipText("数".repeat(50), 10);
    expect(out).toHaveLength(11);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("sanitizePlanForPrompt", () => {
  it("正常 plan 不被改动", () => {
    expect(sanitizePlanForPrompt(plan)).toEqual(plan);
  });

  it("超长字段被裁剪到预算内", () => {
    const huge: PagePlanItem = {
      ...plan,
      title: "标".repeat(500),
      intent: "意".repeat(900),
      bullets: Array.from(
        { length: 30 },
        (_, i) => `要点${i}${"长".repeat(200)}`,
      ),
      quote: "引".repeat(1000),
      attribution: "署".repeat(500),
    };
    const out = sanitizePlanForPrompt(huge);
    expect(out.title.length).toBeLessThanOrEqual(PLAN_FIELD_BUDGET.title + 1);
    expect(out.intent.length).toBeLessThanOrEqual(PLAN_FIELD_BUDGET.intent + 1);
    expect(out.bullets!.length).toBe(PLAN_FIELD_BUDGET.bullets);
    for (const b of out.bullets!) {
      expect(b.length).toBeLessThanOrEqual(PLAN_FIELD_BUDGET.bullet + 1);
    }
    expect(out.quote!.length).toBeLessThanOrEqual(PLAN_FIELD_BUDGET.quote + 1);
    expect(out.attribution!.length).toBeLessThanOrEqual(
      PLAN_FIELD_BUDGET.attribution + 1,
    );
  });

  it("裁剪后的 plan 总体积受控（提示词不会顶爆上下文）", () => {
    const huge: PagePlanItem = {
      ...plan,
      title: "标".repeat(2000),
      intent: "意".repeat(5000),
      bullets: Array.from({ length: 50 }, () => "点".repeat(500)),
      quote: "引".repeat(5000),
    };
    const out = sanitizePlanForPrompt(huge);
    const total =
      out.title.length +
      out.intent.length +
      out.bullets!.reduce((s, b) => s + b.length, 0) +
      (out.quote?.length ?? 0);
    expect(total).toBeLessThan(3000);
  });

  it("缺省字段不补空串（保持 plan 形状）", () => {
    const bare: PagePlanItem = { role: "cover", title: "封面", intent: "" };
    const out = sanitizePlanForPrompt(bare);
    expect(out.bullets).toBeUndefined();
    expect(out.quote).toBeUndefined();
    expect(out.attribution).toBeUndefined();
  });
});

describe("clipBaseSvg", () => {
  it("未超预算原样返回", () => {
    const svg = "<svg><rect/></svg>";
    expect(clipBaseSvg(svg)).toBe(svg);
  });

  it("超预算截断并标注", () => {
    const svg = "<svg>" + "x".repeat(BASE_SVG_BUDGET_CHARS * 2) + "</svg>";
    const out = clipBaseSvg(svg);
    expect(out.length).toBeLessThan(svg.length);
    expect(out).toContain("底稿已截断");
  });
});
