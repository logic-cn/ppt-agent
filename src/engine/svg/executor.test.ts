import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSlideSvg, generateDeckSvgs } from "./executor";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";

const builtSpec: SpecLock = buildSpecLock(DEFAULT_DESIGN);

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

/** 生成包含指定标题的合规 SVG（内容必现性校验要求标题出现在文本中） */
function svgWithTitle(title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">${title}</text></svg>`;
}

/** 从生成 prompt 中提取页面标题（prompt 固定格式：标题：X，意图：Y） */
function titleFromPrompt(req: unknown): string {
  const content = (req as { messages: { content: string }[] }).messages[1]
    ?.content;
  const m = content?.match(/标题：([^，]+)/);
  return m?.[1] ?? "Test title";
}

vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
}));

import { chat } from "@/services/llm";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("generateSlideSvg", () => {
  it("产出含 viewBox 1280×720 的 svg 字符串", async () => {
    vi.mocked(chat).mockResolvedValue({ content: svgWithTitle("第 1 页") });
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

  it("首轮 checkSvg 报 error 时回喂重画，第二次合规后返回合规 svg", async () => {
    const outOfBounds = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="-50" y="0" width="200" height="200" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text></svg>`;
    vi.mocked(chat)
      .mockResolvedValueOnce({ content: outOfBounds })
      .mockResolvedValueOnce({ content: svgWithTitle("第 1 页") });

    const svg = await generateSlideSvg({
      specLock: builtSpec,
      plan: makePlan(1)[0],
      pageIndex: 0,
      totalPages: 1,
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(svg).toBe(svgWithTitle("第 1 页").trim());
    const secondCallArgs = vi.mocked(chat).mock.calls[1][0] as {
      messages: { content: string }[];
    };
    expect(secondCallArgs.messages[1].content).toContain("你的 SVG 有以下问题");
  });

  it("plan 要求图表但 SVG 未渲染图表标记时回喂重画，直到出现图表", async () => {
    const noChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text></svg>`;
    const withChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text><g data-chart-type="bar" data-chart-data='[{"label":"A","value":1}]'></g></svg>`;
    vi.mocked(chat)
      .mockResolvedValueOnce({ content: noChart })
      .mockResolvedValueOnce({ content: withChart });

    const svg = await generateSlideSvg({
      specLock: builtSpec,
      plan: { ...makePlan(1)[0], chartType: "bar" },
      pageIndex: 0,
      totalPages: 1,
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(svg).toBe(withChart.trim());
    const secondCallArgs = vi.mocked(chat).mock.calls[1][0] as {
      messages: { content: string }[];
    };
    expect(secondCallArgs.messages[1].content).toContain("图表缺失");
  });

  it("图表 data 损坏（空数组）时回喂重画", async () => {
    const emptyData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text><g data-chart-type="bar" data-chart-data='[]'></g></svg>`;
    const goodData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text><g data-chart-type="bar" data-chart-data='[{"label":"A","value":1}]'></g></svg>`;
    vi.mocked(chat)
      .mockResolvedValueOnce({ content: emptyData })
      .mockResolvedValueOnce({ content: goodData });

    const svg = await generateSlideSvg({
      specLock: builtSpec,
      plan: { ...makePlan(1)[0], chartType: "bar" },
      pageIndex: 0,
      totalPages: 1,
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(svg).toBe(goodData.trim());
  });

  it("页面软超时按单页失败抛出普通 Error（可被 isolatePageFailures 隔离），而非 AbortError", async () => {
    vi.useFakeTimers();
    try {
      // chat 挂起直到 signal abort 才以 AbortError 拒绝（模拟 LLM 请求被中断）
      vi.mocked(chat).mockImplementation(
        (req) =>
          new Promise((_resolve, reject) => {
            req.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
      const pending = generateSlideSvg({
        specLock: spec,
        plan: makePlan(1)[0],
        pageIndex: 0,
        totalPages: 1,
      });
      // 先挂接断言（拒绝处理器），避免超时拒绝被判定为 unhandled
      const assertion = expect(pending).rejects.toThrow(/超时/);
      await vi.advanceTimersByTimeAsync(90_000);
      // 超时（非用户取消）必须抛普通 Error，而不是 AbortError，
      // 否则 isolatePageFailures 会把超时误判为整体取消
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("用户取消信号中止时保持 AbortError 语义", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      vi.mocked(chat).mockImplementation(
        (req) =>
          new Promise((_resolve, reject) => {
            req.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
      const pending = generateSlideSvg({
        specLock: spec,
        plan: makePlan(1)[0],
        pageIndex: 0,
        totalPages: 1,
        signal: controller.signal,
      });
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("generateDeckSvgs", () => {
  it("串行产生与 plan 顺序一致的结果，并调用 onProgress plan.length 次", async () => {
    const order: number[] = [];
    vi.mocked(chat).mockImplementation(async (req) => {
      const page = (req as { messages: { content: string }[] }).messages[1]
        ?.content;
      const m = page.match(/第 (\d+)\//);
      const n = Number(m?.[1]);
      order.push(n - 1);
      return { content: svgWithTitle(`第 ${n} 页`) };
    });

    const plan = makePlan(4);
    const progresses: Array<[number, number]> = [];
    const pages = await generateDeckSvgs(plan, spec, {
      onProgress: (d, t) => progresses.push([d, t]),
    });

    expect(pages).toHaveLength(4);
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2, 3]);
    expect(order).toEqual([0, 1, 2, 3]);

    expect(progresses).toHaveLength(4);
    expect(progresses[3]).toEqual([4, 4]);

    expect(chat).toHaveBeenCalledTimes(4);
  });

  it("signal 已中止时不发起任何请求，直接抛 AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateDeckSvgs(makePlan(2), spec, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("逐页生成期间 signal 中止则中断后续页", async () => {
    const controller = new AbortController();
    let calls = 0;
    vi.mocked(chat).mockImplementation(async (req) => {
      calls++;
      const title = titleFromPrompt(req);
      if (calls === 2) controller.abort();
      return { content: svgWithTitle(title) };
    });

    await expect(
      generateDeckSvgs(makePlan(4), spec, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(2);
  });
});

describe("generateDeckSvgs early gate（跨页一致性门）", () => {
  function offPaletteSvg(title: string): string {
    return svgWithTitle(title).replace(/#FFFFFF/g, "#123456");
  }

  it("cohort 页越锁时基于底稿修复，并向剩余页下发一致性要求", async () => {
    const plans = makePlan(7);
    vi.mocked(chat).mockImplementation(async (req: unknown) => {
      const content = (req as { messages: { content: string }[] }).messages[1]
        .content;
      // 修复调用（定向修改模式）：返回合规 SVG
      if (content.includes("定向修改要求")) {
        return { content: svgWithTitle("第 1 页") };
      }
      const title = titleFromPrompt(req);
      // 首次生成的第 1 页使用越锁颜色
      return {
        content:
          title === "第 1 页" ? offPaletteSvg(title) : svgWithTitle(title),
      };
    });

    const pages = await generateDeckSvgs(plans, spec);

    // 第 1 页被修复为合规颜色
    expect(pages[0].svg).not.toContain("#123456");
    expect(pages[0].svg).toContain("第 1 页");
    // 剩余页（第 6、7 页）的 prompt 携带全 deck 一致性要求
    const guided = vi
      .mocked(chat)
      .mock.calls.filter((c) =>
        (
          c[0] as { messages: { content: string }[] }
        ).messages[1].content.includes("全 deck 一致性要求"),
      );
    expect(guided.length).toBe(2);
    expect(guided[0][0]).toMatchObject({
      messages: [
        expect.anything(),
        { content: expect.stringContaining("配色越锁") },
      ],
    });
  });

  it("skipEarlyGate 时跳过一致性门，不产生修复与指引", async () => {
    const plans = makePlan(7);
    vi.mocked(chat).mockImplementation(async (req: unknown) => {
      const title = titleFromPrompt(req);
      return {
        content:
          title === "第 1 页" ? offPaletteSvg(title) : svgWithTitle(title),
      };
    });

    const pages = await generateDeckSvgs(plans, spec, { skipEarlyGate: true });
    expect(pages[0].svg).toContain("#123456");
    const guided = vi
      .mocked(chat)
      .mock.calls.filter((c) =>
        (
          c[0] as { messages: { content: string }[] }
        ).messages[1].content.includes("全 deck 一致性要求"),
      );
    expect(guided.length).toBe(0);
  });

  it("合规 cohort 不触发修复，正常生成全部页", async () => {
    const plans = makePlan(7);
    vi.mocked(chat).mockImplementation(async (req: unknown) => ({
      content: svgWithTitle(titleFromPrompt(req)),
    }));
    const pages = await generateDeckSvgs(plans, spec);
    expect(pages).toHaveLength(7);
    // 每页恰好调用一次 chat
    expect(vi.mocked(chat).mock.calls.length).toBe(7);
  });
});

describe("generateDeckSvgs onPageReady（D2 流式预览）", () => {
  it("每页就绪即回调，修复页以修复后 SVG 二次回调", async () => {
    const plans = makePlan(3);
    vi.mocked(chat).mockImplementation(async (req: unknown) => ({
      content: svgWithTitle(titleFromPrompt(req)),
    }));
    const ready: [number, string][] = [];
    await generateDeckSvgs(plans, spec, {
      onPageReady: (i, svg) => ready.push([i, svg]),
    });
    expect(ready.map(([i]) => i)).toEqual([0, 1, 2]);
    expect(ready[2][1]).toContain("第 3 页");
  });

  it("skipEarlyGate 路径同样回调", async () => {
    const plans = makePlan(2);
    vi.mocked(chat).mockImplementation(async (req: unknown) => ({
      content: svgWithTitle(titleFromPrompt(req)),
    }));
    const ready: number[] = [];
    await generateDeckSvgs(plans, spec, {
      skipEarlyGate: true,
      onPageReady: (i) => ready.push(i),
    });
    expect(ready).toEqual([0, 1]);
  });
});
