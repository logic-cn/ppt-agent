import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock } from "@/design/spec-lock";
import { generatePagePlan } from "@/services/outline";
import { generateDeckSvgs } from "./executor";

/** 进度回调：已完成页数、总页数 */
export type DeckSvgProgress = (done: number, total: number) => void;

export interface BuildDeckSvgsOptions {
  /** 主题/听众/页数/文档内容等，透传给 generatePagePlan */
  topic: string;
  audience?: string;
  pageCount?: number;
  docContent?: string;
  signal?: AbortSignal;
  onProgress?: DeckSvgProgress;
}

/**
 * 串联「pagePlan → executor 逐页生成 SVG → 写回 deck」的编排函数（纯函数）。
 *
 * 行为：
 * 1. 由 pagePlan 驱动生成 N 页 SVG（逐页串行，禁止并行）。
 * 2. 若入参 deck 已有 slides，按 slide 顺序覆盖其 svg 字段（slide 数量以 pagePlan 为准，
 *    取 min(deck.slides.length, plan.length) 对齐；多出的 deck slide 保留原样）。
 * 3. 若 deck 无 slides（或数量少于 plan），按 plan 顺序新建带 svg 的 slide。
 * 4. 不修改入参，返回新 deck 对象。
 */
export async function buildDeckSvgs(
  deck: Deck,
  design: DesignLock,
  options: BuildDeckSvgsOptions,
): Promise<Deck> {
  const spec = buildSpecLock(design);
  const plan = await generatePagePlan({
    topic: options.topic ?? deck.title,
    design,
    audience: options.audience,
    pageCount: options.pageCount,
    docContent: options.docContent,
    signal: options.signal,
  });

  const pages = await generateDeckSvgs(plan, spec, options.onProgress);

  const baseSlides = deck.slides ?? [];
  const slides: Slide[] = baseSlides.map((s) => ({ ...s }));

  for (let i = 0; i < pages.length; i++) {
    const svg = pages[i].svg;
    if (i < slides.length) {
      slides[i] = { ...slides[i], svg };
    } else {
      slides.push({
        id: `s${i + 1}`,
        layout: pages[i].role as Slide["layout"],
        title: plan[i].title,
        svg,
      });
    }
  }

  return {
    ...deck,
    design,
    slides,
    updatedAt: Date.now(),
  };
}
