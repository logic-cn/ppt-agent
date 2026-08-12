import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock } from "@/design/spec-lock";
import { generatePagePlan } from "@/services/outline";
import { semanticRoleToLayout } from "@/types/page-plan";
import { generateDeckSvgs } from "./executor";
import type { SvgPage } from "./types";

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
  /**
   * 单页失败是否隔离：为 true 时某页生成失败不会中断整份 deck，
   * 已有 slide 的 svg 会被保留（新页则以空 svg 占位），失败信息通过 onPageError 回传。
   * 默认 false（保持原行为：任一页失败即整体失败）。
   */
  isolatePageFailures?: boolean;
  /** isolatePageFailures 时逐页失败回调：pageIndex、错误信息、是否保留了旧 svg */
  onPageError?: (pageIndex: number, error: Error, keptOldSvg: boolean) => void;
}

export interface BuildDeckSvgsResult {
  deck: Deck;
  /** 失败的页面索引（isolatePageFailures 开启时才有） */
  failedPages: number[];
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
  const { deck: result } = await buildDeckSvgsDetailed(deck, design, options);
  return result;
}

export async function buildDeckSvgsDetailed(
  deck: Deck,
  design: DesignLock,
  options: BuildDeckSvgsOptions,
): Promise<BuildDeckSvgsResult> {
  const spec = buildSpecLock(design);
  const plan = await generatePagePlan({
    topic: options.topic ?? deck.title,
    design,
    audience: options.audience,
    pageCount: options.pageCount,
    docContent: options.docContent,
    signal: options.signal,
  });

  let pages: SvgPage[] = [];
  let failedPages: number[] = [];
  if (options.isolatePageFailures) {
    // 单页失败隔离：逐页独立生成，失败页保留旧 svg（或空占位），不中断整份 deck
    const total = plan.length;
    const signal = options.signal;
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        const { generateSlideSvg } = await import("./executor");
        const svg = await generateSlideSvg({
          specLock: spec,
          plan: plan[i],
          pageIndex: i,
          totalPages: total,
          signal,
        });
        pages.push({ index: i, role: plan[i].role, svg });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        failedPages.push(i);
        const err = e instanceof Error ? e : new Error(String(e));
        const keptOldSvg = i < (deck.slides ?? []).length;
        options.onPageError?.(i, err, keptOldSvg);
      }
      options.onProgress?.(i + 1, total);
    }
  } else {
    pages = await generateDeckSvgs(plan, spec, {
      onProgress: options.onProgress,
      signal: options.signal,
    });
  }

  const baseSlides = deck.slides ?? [];
  const slides: Slide[] = baseSlides.map((s) => ({ ...s }));

  // 按页面索引对齐写回：非隔离模式 pages 与 plan 顺序一一对应；
  // 隔离模式下失败页不在 pages 中——已有 slide 保留旧 svg，新页以无 svg 占位（留待重画）。
  const pageByIndex = new Map(pages.map((p) => [p.index, p]));
  for (let i = 0; i < plan.length; i++) {
    const page = pageByIndex.get(i);
    if (i < slides.length) {
      slides[i] = page ? { ...slides[i], svg: page.svg } : slides[i];
    } else if (page) {
      slides.push({
        id: `s${i + 1}`,
        // 经语义角色映射得到合法布局（comparison→two-column、process→content），
        // 不做类型断言强转，保证写回 slide 的 layout 一定是合法枚举值。
        layout: semanticRoleToLayout(page.role),
        title: plan[i].title,
        svg: page.svg,
      });
    } else {
      // 隔离模式下失败的新页：占位（无 svg），标题/布局从 plan 派生
      slides.push({
        id: `s${i + 1}`,
        layout: semanticRoleToLayout(plan[i].role),
        title: plan[i].title,
      });
    }
  }

  return {
    deck: {
      ...deck,
      design,
      slides,
      updatedAt: Date.now(),
    },
    failedPages,
  };
}
