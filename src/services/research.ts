/**
 * 联网资料补全（D4，参照 PPT Master topic-research 阶段）：
 * topic-only 生成缺乏事实支撑时，先通过 Tavily 检索并抓取原文，
 * 拼装为资料文档注入大纲规划（docContent 链路复用导入增强管线）。
 * 需要设置页开启并配置 Tavily Key（免费额度）；未开启/失败时静默跳过，
 * 生成行为与原先一致。
 */

export interface ResearchResult {
  /** 拼装后的资料文本（markdown：标题+URL+摘要/原文节选） */
  text: string;
  /** 来源 URL 列表 */
  sources: string[];
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
}

/** Tavily 检索并拼装资料文本（原文超长页截断，控制上下文预算） */
export async function researchTopic(
  topic: string,
  opts: { apiKey: string; signal?: AbortSignal; maxResults?: number },
): Promise<ResearchResult> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: opts.apiKey,
      query: topic,
      search_depth: "basic",
      max_results: opts.maxResults ?? 5,
      include_raw_content: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`资料检索失败（Tavily ${res.status}）`);
  }
  const data = (await res.json()) as { results?: TavilyResult[] };
  const results = (data.results ?? []).filter((r) => r.url);
  const parts: string[] = [];
  const sources: string[] = [];
  for (const r of results) {
    sources.push(r.url!);
    const body = (r.raw_content || r.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    parts.push(`## ${r.title || r.url}\n来源：${r.url}\n${body}`);
  }
  return {
    text: parts.join("\n\n"),
    sources,
  };
}
