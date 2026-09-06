/**
 * 视觉自检闭环（D3，参照 PPT Master visual-review 工作流）：
 * 栅格化页面 → 视觉模型按审查清单打分 → 不通过的页面携带具体问题
 * 定向重画一轮。问题反馈来自「看见的渲染结果」，能捕获几何检查
 * 覆盖不到的观感缺陷（对比度/重叠/对齐/失衡）。
 */

import { chat } from "@/services/llm";
import type { SpecLock } from "@/design/spec-lock";
import { rasterizeSvg } from "@/engine/svg/rasterize";

export interface VisualReviewResult {
  pass: boolean;
  issues: string[];
  /** 审查调用本身失败（模型不支持视觉/网络等） */
  error?: string;
}

interface ReviewResponse {
  pass?: boolean;
  issues?: unknown;
}

function parseReview(content: string): VisualReviewResult {
  let raw: unknown;
  let parseFailed = false;
  try {
    raw = JSON.parse(content);
  } catch {
    const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    try {
      raw = m ? JSON.parse(m[1]) : undefined;
      parseFailed = raw === undefined;
    } catch {
      parseFailed = true;
    }
  }
  if (parseFailed) {
    return {
      pass: true,
      issues: [],
      error: "视觉审查返回无法解析，本页跳过",
    };
  }
  const r = (raw ?? {}) as ReviewResponse;
  const issues = Array.isArray(r.issues)
    ? r.issues.filter((i): i is string => typeof i === "string" && !!i.trim())
    : [];
  return { pass: r.pass !== false, issues };
}

/** 单页视觉审查：pass=false 时 issues 为具体可执行的修改点 */
export async function reviewSlideVisual(opts: {
  svg: string;
  specLock: SpecLock;
  signal?: AbortSignal;
}): Promise<VisualReviewResult> {
  let image: string;
  try {
    image = await rasterizeSvg(opts.svg);
  } catch (e) {
    return { pass: true, issues: [], error: (e as Error).message };
  }

  const c = opts.specLock.colors;
  const rubric = [
    "你是幻灯片视觉质量审查员。根据页面截图与设计契约，只审查以下五类观感缺陷：",
    "1. 文字与背景对比度不足（浅色字在浅底/深色字在深底）",
    "2. 元素重叠或被裁切（文字压字、图形越出画布）",
    "3. 对齐混乱（同类元素基线/间距明显不齐）",
    "4. 留白失衡（一侧过挤一侧过空、内容贴边）",
    "5. 视觉层级不清（重点不突出、字号杂乱）",
    `设计契约：配色 primary ${c.primary} / surface ${c.surface} / text ${c.text}；画布 1280×720。`,
    "不要评述风格偏好，只报告可执行的具体缺陷。",
    '只输出 JSON：通过为 {"pass": true}；不通过为 {"pass": false, "issues": ["每条一句话、指明位置与改法"]}',
  ].join("\n");

  const res = await chat(
    {
      messages: [
        {
          role: "system",
          content: "你是幻灯片视觉质量审查员。只输出 JSON。",
        },
        {
          role: "user",
          content: [
            { type: "text", text: rubric },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      temperature: 0.2,
      maxTokens: 600,
      responseFormat: "json",
      signal: opts.signal,
    },
    "svg",
  );
  return parseReview(res.content);
}
