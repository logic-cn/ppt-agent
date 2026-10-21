import { describe, it, expect } from "vitest";
import { buildLayoutSkeleton } from "./layout-skeleton";
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
  typography: { title: 44, section: 32, body: 24, caption: 16, hero: 79 },
  style: "soft-rounded",
  icons: [],
};

function plan(overrides: Partial<PagePlanItem> = {}): PagePlanItem {
  return {
    role: "content",
    title: "市场规模与增速",
    intent: "说明规模",
    bullets: ["市场规模 970 亿美元", "近三年 CAGR 18%", "头部厂商集中度上升"],
    ...overrides,
  };
}

describe("buildLayoutSkeleton 不变式", () => {
  for (const role of [
    "content",
    "comparison",
    "timeline",
    "process",
    "metrics",
    "quote",
  ] as const) {
    it(`${role}：所有区块落在画布内且不越安全区`, () => {
      const sk = buildLayoutSkeleton(
        plan({ role, bullets: role === "quote" ? undefined : plan().bullets }),
        SPEC,
      );
      expect(sk).not.toBeNull();
      for (const b of sk!.boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(SPEC.canvas.w);
        expect(b.y + b.h).toBeLessThanOrEqual(SPEC.canvas.h + 40);
        expect(b.w).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
      }
    });
  }

  it("确定性：同输入两次调用逐字节一致", () => {
    const a = buildLayoutSkeleton(plan(), SPEC);
    const b = buildLayoutSkeleton(plan(), SPEC);
    expect(a?.promptBlock).toBe(b?.promptBlock);
  });

  it("每个文字区块都带正数字数预算", () => {
    const sk = buildLayoutSkeleton(plan(), SPEC)!;
    expect(sk.promptBlock).toContain("每行最多");
    const perLine = [...sk.promptBlock.matchAll(/每行最多 (\d+) 字/g)].map(
      (m) => Number(m[1]),
    );
    expect(perLine.length).toBeGreaterThan(0);
    for (const n of perLine) expect(n).toBeGreaterThan(0);
  });

  it("content：要点区块纵向不互叠", () => {
    const sk = buildLayoutSkeleton(plan(), SPEC)!;
    const bullets = sk.boxes.filter((b) => b.kind === "bullet");
    expect(bullets).toHaveLength(3);
    for (let i = 1; i < bullets.length; i++) {
      expect(bullets[i].y).toBeGreaterThan(bullets[i - 1].y);
    }
  });

  it("comparison：两栏等宽、对称排布", () => {
    const sk = buildLayoutSkeleton(
      plan({ role: "comparison", bullets: ["a", "b", "c", "d"] }),
      SPEC,
    )!;
    const cols = sk.boxes.filter((b) => b.kind === "column");
    expect(cols).toHaveLength(2);
    expect(cols[0].w).toBe(cols[1].w);
    expect(cols[1].x).toBe(cols[0].x + cols[0].w + Math.round(1280 / 32));
  });

  it("metrics：KPI 卡不超过 3 张、等宽并排", () => {
    const sk = buildLayoutSkeleton(
      plan({ role: "metrics", bullets: ["1", "2", "3", "4", "5"] }),
      SPEC,
    )!;
    const kpis = sk.boxes.filter((b) => b.kind === "kpi");
    expect(kpis).toHaveLength(3);
    expect(kpis[1].x).toBeGreaterThan(kpis[0].x + kpis[0].w);
  });

  it("timeline：节点标签上下交替", () => {
    const sk = buildLayoutSkeleton(plan({ role: "timeline" }), SPEC)!;
    const nodes = sk.boxes.filter((b) => b.kind === "node");
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    const ys = nodes.map((n) => n.y);
    const above = ys.filter((y) => y < 373).length;
    expect(above).toBeGreaterThan(0);
    expect(ys.length - above).toBeGreaterThan(0);
  });

  it("图表页与封面/结尾页返回 null（不适用坐标下发）", () => {
    expect(buildLayoutSkeleton(plan({ chartType: "bar" }), SPEC)).toBeNull();
    expect(buildLayoutSkeleton(plan({ role: "cover" }), SPEC)).toBeNull();
    expect(buildLayoutSkeleton(plan({ role: "closing" }), SPEC)).toBeNull();
  });

  it("章节页有确定性骨架（端侧模型最常连续产出，是版式雷同高发区）", () => {
    const sk = buildLayoutSkeleton(
      plan({ role: "section", bullets: ["甲", "乙", "丙", "丁"] }),
      SPEC,
    );
    expect(sk).not.toBeNull();
    expect(sk!.boxes[0].fontRole).toBe("section");
    for (const b of sk!.boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(SPEC.canvas.w);
      expect(b.y + b.h).toBeLessThanOrEqual(SPEC.canvas.h);
    }
  });

  it("要点超过 7 条回退 null（交由内容层裁剪）", () => {
    const many = plan({ bullets: ["1", "2", "3", "4", "5", "6", "7", "8"] });
    expect(buildLayoutSkeleton(many, SPEC)).toBeNull();
  });

  it("非 1280 画布自适应：4:3 画布骨架仍在界内", () => {
    const spec43 = { ...SPEC, canvas: { w: 960, h: 720 } };
    const sk = buildLayoutSkeleton(plan(), spec43)!;
    for (const b of sk.boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(960);
    }
  });
});

describe("跨页版式轮换（content variant）", () => {
  const manyBullets = plan({
    bullets: ["甲", "乙", "丙", "丁", "戊"],
  });

  it("variant=1 双栏：≥4 条要点左右分栏、全部在画布内且确定", () => {
    const a = buildLayoutSkeleton(manyBullets, SPEC, { variant: 1 });
    const b = buildLayoutSkeleton(manyBullets, SPEC, { variant: 1 });
    expect(a).not.toBeNull();
    expect(a!.promptBlock).toBe(b!.promptBlock);
    expect(a!.promptBlock).toContain("双栏");
    for (const box of a!.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(SPEC.canvas.w);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(SPEC.canvas.h);
    }
    // 左栏与右栏各有点：两栏 x 分布不同
    const bulletBoxes = a!.boxes.filter((x) => x.kind === "bullet");
    const lefts = [...new Set(bulletBoxes.map((x) => x.x))];
    expect(lefts.length).toBeGreaterThanOrEqual(2);
  });

  it("variant=1 与 variant=0 版式不同（打破雷同）", () => {
    const v0 = buildLayoutSkeleton(manyBullets, SPEC, { variant: 0 });
    const v1 = buildLayoutSkeleton(manyBullets, SPEC, { variant: 1 });
    expect(v0!.promptBlock).not.toContain("双栏");
    expect(v1!.promptBlock).toContain("双栏");
    expect(v0!.boxes.map((b) => `${b.x},${b.y}`).join()).not.toBe(
      v1!.boxes.map((b) => `${b.x},${b.y}`).join(),
    );
  });

  it("要点 <4 时 variant=1 回落整宽列表", () => {
    const few = plan({ bullets: ["甲", "乙"] });
    const v1 = buildLayoutSkeleton(few, SPEC, { variant: 1 });
    expect(v1!.promptBlock).not.toContain("双栏");
  });

  it("章节页同样支持 variant=1 双栏（轮换覆盖章节页）", () => {
    const sec = plan({ role: "section", bullets: ["甲", "乙", "丙", "丁"] });
    const wide = buildLayoutSkeleton(sec, SPEC, { variant: 0 })!;
    const two = buildLayoutSkeleton(sec, SPEC, { variant: 1 })!;
    expect(two.promptBlock).not.toBe(wide.promptBlock);
    // 双栏：要点起始 x 出现第二个列（> 画布中线）
    const cols = new Set(
      two.boxes
        .filter((b) => b.kind === "bullet")
        .map((b) => (b.x > 600 ? "right" : "left")),
    );
    expect(cols.size).toBe(2);
  });

  it("默认（不传 opts）等价 variant=0", () => {
    const d = buildLayoutSkeleton(manyBullets, SPEC);
    const v0 = buildLayoutSkeleton(manyBullets, SPEC, { variant: 0 });
    expect(d!.promptBlock).toBe(v0!.promptBlock);
  });
});
