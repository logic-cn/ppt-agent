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
  isLocalModelActive: vi.fn(() => false),
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
      specLock: spec,
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
      specLock: spec,
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
      specLock: spec,
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
  // 越锁字体：autoPatch 只吸附越锁「颜色」，字体越锁仍需 cohort 门下发定向修复
  function offLockSvg(title: string): string {
    return svgWithTitle(title).replace(
      /font-family="Noto Sans SC"/,
      'font-family="Impact"',
    );
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
      // 首次生成的第 1 页使用越锁字体
      return {
        content: title === "第 1 页" ? offLockSvg(title) : svgWithTitle(title),
      };
    });

    const pages = await generateDeckSvgs(plans, spec);

    // 第 1 页被修复为合规字体
    expect(pages[0].svg).not.toContain("Impact");
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
        { content: expect.stringContaining("字体越锁") },
      ],
    });
  });

  it("early gate 修复后复验：修复成功的问题不再下发，残余问题如实下发", async () => {
    // 第 1 页字体越锁（修复成功）、第 2 页 text 内越锁色（autoPatch 不动 text
    // 内取色，修复模拟失败）→ 剩余页 guidance 只应包含残余的配色问题
    const offColorSvg = (title: string) =>
      svgWithTitle(title).replace('fill="#0F172A"', 'fill="#ABCDEF"');
    const plans = makePlan(7);
    vi.mocked(chat).mockImplementation(async (req: unknown) => {
      const content = (req as { messages: { content: string }[] }).messages[1]
        .content;
      if (content.includes("定向修改要求")) {
        // 第 1 页修复成功；第 2 页修复失败（原样返回越锁色）
        if (content.includes("字体越锁")) {
          return { content: svgWithTitle("第 1 页") };
        }
        return { content: offColorSvg("第 2 页") };
      }
      const title = titleFromPrompt(req);
      if (title === "第 1 页") return { content: offLockSvg(title) };
      if (title === "第 2 页") return { content: offColorSvg(title) };
      return { content: svgWithTitle(title) };
    });

    const pages = await generateDeckSvgs(plans, spec);

    // 第 1 页修复成功、第 2 页修复失败
    expect(pages[0].svg).not.toContain("Impact");
    expect(pages[1].svg).toContain("#ABCDEF");

    const guided = vi
      .mocked(chat)
      .mock.calls.filter((c) =>
        (
          c[0] as { messages: { content: string }[] }
        ).messages[1].content.includes("全 deck 一致性要求"),
      );
    expect(guided.length).toBe(2);
    for (const call of guided) {
      const body = (call[0] as { messages: { content: string }[] }).messages[1]
        .content;
      // 残余问题下发
      expect(body).toContain("配色越锁");
      // 修复成功的问题不再下发（旧逻辑会把修复前全部问题原样下发）
      expect(body).not.toContain("字体越锁");
    }
  });

  it("skipEarlyGate 时跳过一致性门，不产生修复与指引", async () => {
    const plans = makePlan(7);
    vi.mocked(chat).mockImplementation(async (req: unknown) => {
      const title = titleFromPrompt(req);
      return {
        content: title === "第 1 页" ? offLockSvg(title) : svgWithTitle(title),
      };
    });

    const pages = await generateDeckSvgs(plans, spec, { skipEarlyGate: true });
    expect(pages[0].svg).toContain("Impact");
    const guided = vi
      .mocked(chat)
      .mock.calls.filter((c) =>
        (
          c[0] as { messages: { content: string }[] }
        ).messages[1].content.includes("全 deck 一致性要求"),
      );
    expect(guided.length).toBe(0);
  });

  it("原子修复：越锁颜色在生成环内被吸附回色板，不消耗重画轮次", async () => {
    // 结构完全合法、仅颜色越锁：autoPatch 直接吸附，chat 只调用一次
    const offColor = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#123456"/><text x="100" y="100" font-size="40" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text></svg>`;
    vi.mocked(chat).mockResolvedValue({ content: offColor });
    const svg = await generateSlideSvg({
      specLock: spec,
      plan: makePlan(1)[0],
      pageIndex: 0,
      totalPages: 1,
    });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(svg).not.toContain("#123456");
    // 色板 token 中距 #123456 最近的是 text #0F172A
    expect(svg).toContain('fill="#0F172A"');
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

describe("generateSlideSvg 修复环最优候选", () => {
  const title = `<text x="100" y="100" font-size="40" font-family="Noto Sans SC" fill="#0F172A">第 1 页</text>`;
  // 一处文字重叠 = 1 个 error
  const oneError = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${title}<text x="130" y="115" font-size="40" fill="#0F172A">重叠甲</text></svg>`;
  // 越界 + 重叠 = 更多 error，模拟「越修越坏」
  const worse = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${title}<text x="130" y="115" font-size="40" fill="#0F172A">重叠甲</text><text x="1150" y="300" font-size="40" fill="#0F172A">很长的文字越界测试越界文字</text></svg>`;

  it("末轮重画更差时返回错误最少版本而非最后一轮", async () => {
    vi.mocked(chat)
      .mockResolvedValueOnce({ content: oneError })
      .mockResolvedValueOnce({ content: worse })
      .mockResolvedValueOnce({ content: worse });
    const svg = await generateSlideSvg({
      specLock: spec,
      plan: { role: "content", title: "第 1 页", intent: "t" },
      pageIndex: 0,
      totalPages: 1,
    });
    expect(chat).toHaveBeenCalledTimes(3);
    expect(svg).toBe(oneError.trim());
  });

  it("文本重叠错误会进入回喂反馈", async () => {
    vi.mocked(chat)
      .mockResolvedValueOnce({ content: oneError })
      .mockResolvedValueOnce({
        content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${title}</svg>`,
      });
    await generateSlideSvg({
      specLock: spec,
      plan: { role: "content", title: "第 1 页", intent: "t" },
      pageIndex: 0,
      totalPages: 1,
    });
    const secondPrompt = (
      vi.mocked(chat).mock.calls[1][0] as {
        messages: { content: string }[];
      }
    ).messages[1].content;
    expect(secondPrompt).toContain("文字重叠");
  });
});
