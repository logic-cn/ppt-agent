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
    const perLine = [...sk.promptBlock.matchAll(/每行最多 (\d+) 字/g)].map((m) =>
      Number(m[1]),
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

  it("图表页与封面/章节页返回 null（不适用坐标下发）", () => {
    expect(buildLayoutSkeleton(plan({ chartType: "bar" }), SPEC)).toBeNull();
    expect(buildLayoutSkeleton(plan({ role: "cover" }), SPEC)).toBeNull();
    expect(buildLayoutSkeleton(plan({ role: "section" }), SPEC)).toBeNull();
    expect(buildLayoutSkeleton(plan({ role: "closing" }), SPEC)).toBeNull();
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
