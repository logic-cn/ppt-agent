import { describe, it, expect } from "vitest";
import { pagePlanItemSchema, pagePlanRootSchema } from "./page-plan-grammar";

describe("pagePlan 语法 schema 接受演讲备注 notes", () => {
  it("item 带 notes 可解析并保留", () => {
    const r = pagePlanItemSchema.safeParse({
      role: "content",
      title: "市场规模",
      intent: "说明规模",
      bullets: ["a"],
      notes: "本页讲稿……",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.notes).toBe("本页讲稿……");
  });

  it("notes 可选：缺省解析通过且为 undefined", () => {
    const r = pagePlanItemSchema.safeParse({
      role: "cover",
      title: "封面",
      intent: "点题",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.notes).toBeUndefined();
  });

  it("toJSONSchema 派生的 grammar 含 notes 字段（约束解码可用）", () => {
    const json = JSON.stringify(pagePlanRootSchema);
    expect(json).toContain("pages");
  });
});
