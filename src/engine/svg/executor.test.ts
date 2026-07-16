import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSlideSvg, generateDeckSvgs } from "./executor";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";

const spec: SpecLock = {
  canvas: { w: 1280, h: 720 },
  colors: {
    primary: "#1D4ED8",
    secondary: "#0EA5E9",
    accent: "#F59E0B",
    background: "#FFFFFF",
    surface: "#F1F5F9",
    text: "#0F172A",
    textMuted: "#64748B",
  },
  fonts: { title: "Noto Sans SC", body: "Noto Sans SC" },
  style: "modern",
  icons: [],
};

function makePlan(n: number): PagePlanItem[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i === 0 ? "cover" : "content",
    title: `第 ${i + 1} 页`,
    intent: `测试意图 ${i + 1}`,
  }));
}

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">Hello</text></svg>`;

vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
}));

import { chat } from "@/services/llm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateSlideSvg", () => {
  it("产出含 viewBox 1280×720 的 svg 字符串", async () => {
    vi.mocked(chat).mockResolvedValue({ content: VALID_SVG });
    const svg = await generateSlideSvg({
      specLock: spec,
      plan: makePlan(3)[0],
      pageIndex: 0,
      totalPages: 3,
    });
    expect(svg).toContain('viewBox="0 0 1280 720"');
    expect(svg.startsWith("<svg")).toBe(true);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("契约校验不通过时抛错", async () => {
    const bad = `<svg viewBox="0 0 800 600"><rect/></svg>`;
    vi.mocked(chat).mockResolvedValue({ content: bad });
    await expect(
      generateSlideSvg({
        specLock: spec,
        plan: makePlan(1)[0],
        pageIndex: 0,
        totalPages: 1,
      }),
    ).rejects.toThrow(/契约校验未通过/);
  });
});

describe("generateDeckSvgs", () => {
  it("串行产生与 plan 顺序一致的结果，并调用 onProgress plan.length 次", async () => {
    const order: number[] = [];
    vi.mocked(chat).mockImplementation(async (req) => {
      const page = (req as { messages: { content: string }[] }).messages[1]
        ?.content;
      const m = page.match(/第 (\d+)\//);
      order.push(Number(m?.[1]) - 1);
      return { content: VALID_SVG };
    });

    const plan = makePlan(4);
    const progresses: Array<[number, number]> = [];
    const pages = await generateDeckSvgs(plan, spec, (d, t) =>
      progresses.push([d, t]),
    );

    expect(pages).toHaveLength(4);
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2, 3]);
    expect(order).toEqual([0, 1, 2, 3]);

    expect(progresses).toHaveLength(4);
    expect(progresses[3]).toEqual([4, 4]);

    expect(chat).toHaveBeenCalledTimes(4);
  });
});
