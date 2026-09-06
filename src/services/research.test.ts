// 联网资料补全测试（D4）：mock Tavily
import { describe, it, expect, vi, afterEach } from "vitest";
import { researchTopic } from "./research";

describe("researchTopic", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("检索结果拼装为 markdown 资料（标题+来源+正文节选）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.api_key).toBe("TVLY_KEY");
        expect(body.include_raw_content).toBe(true);
        return new Response(
          JSON.stringify({
            results: [
              {
                title: "行业报告",
                url: "https://example.com/report",
                raw_content: "2026 年市场规模 970 亿元，CAGR 18%。",
              },
              {
                title: "新闻",
                url: "https://example.com/news",
                content: "摘要内容",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );
    const r = await researchTopic("AI 行业分析", { apiKey: "TVLY_KEY" });
    expect(r.sources).toEqual([
      "https://example.com/report",
      "https://example.com/news",
    ]);
    expect(r.text).toContain("## 行业报告");
    expect(r.text).toContain("https://example.com/report");
    expect(r.text).toContain("970 亿元");
    expect(r.text).toContain("摘要内容");
  });

  it("HTTP 失败抛出可读错误（调用方静默跳过）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 401 })),
    );
    await expect(researchTopic("t", { apiKey: "BAD" })).rejects.toThrow("401");
  });

  it("原文超长页截断到 3000 字", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  title: "长文",
                  url: "https://example.com/long",
                  raw_content: "字".repeat(9000),
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const r = await researchTopic("t", { apiKey: "K" });
    expect(r.text.length).toBeLessThan(3300);
  });
});
