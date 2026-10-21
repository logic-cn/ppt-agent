import type { PagePlanItem } from "@/types/page-plan";

/**
 * 单页提示词的字段预算。
 *
 * 端侧模型上下文只有 8K/16K token，而 pagePlan 的任一字段（尤其 quote /
 * bullets）由模型自由生成——一旦异常膨胀（例如把整段原文塞进 quote），
 * 拼出的提示词会直接顶穿上下文，该页生成必然失败。
 * 实测（端侧无头实跑）：提示词一度膨胀到 25002 token，超出 8192 上下文，
 * 页面以「提示词过长」失败。字段预算即为此设的护栏。
 */
export const PLAN_FIELD_BUDGET = {
  title: 60,
  intent: 120,
  bullet: 80,
  bullets: 12,
  quote: 240,
  attribution: 80,
} as const;

/** 截断文本到指定字符数（超出部分用省略号收尾） */
export function clipText(text: string, max: number): string {
  if (!text) return text;
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * 裁剪 pagePlan 的字段体积，供单页提示词使用。
 *
 * 注意：裁剪后的 plan 同时用于「内容必现性」校验——模型是被要求渲染裁剪后
 * 的文本，校验也必须对齐同一份，否则会误判内容缺失并触发无谓重画。
 */
export function sanitizePlanForPrompt(plan: PagePlanItem): PagePlanItem {
  const bullets = (plan.bullets ?? [])
    .slice(0, PLAN_FIELD_BUDGET.bullets)
    .map((b) => clipText(b, PLAN_FIELD_BUDGET.bullet));
  return {
    ...plan,
    title: clipText(plan.title, PLAN_FIELD_BUDGET.title),
    intent: clipText(plan.intent, PLAN_FIELD_BUDGET.intent),
    ...(plan.bullets ? { bullets } : {}),
    ...(plan.quote
      ? { quote: clipText(plan.quote, PLAN_FIELD_BUDGET.quote) }
      : {}),
    ...(plan.attribution
      ? {
          attribution: clipText(
            plan.attribution,
            PLAN_FIELD_BUDGET.attribution,
          ),
        }
      : {}),
  };
}

/** 回传给模型的底稿 SVG 的字符预算（同上：防止底稿把提示词顶爆上下文） */
export const BASE_SVG_BUDGET_CHARS = 8000;

/** 底稿 SVG 超预算时截断（保留头部结构，尾部标注截断） */
export function clipBaseSvg(svg: string): string {
  if (svg.length <= BASE_SVG_BUDGET_CHARS) return svg;
  return `${svg.slice(0, BASE_SVG_BUDGET_CHARS)}\n<!-- 底稿已截断，仅保留前 ${BASE_SVG_BUDGET_CHARS} 字符 -->`;
}
