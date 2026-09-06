import type { Deck, Slide, BulletNode } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import type { GenerationOptions } from "@/types/generation";
import { buildSpecLock } from "@/design/spec-lock";
import { generatePagePlan } from "@/services/outline";
import { semanticRoleToLayout } from "@/types/page-plan";
import type { TemplateGenerationContext } from "@/presets/template-context";
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
  /** 生成前参数控制（场景/语气/密度/图表倾向/语言等），透传给 generatePagePlan */
  options?: GenerationOptions;
  /** 页面结构规划完成（D2 流式预览：上屏占位页） */
  onPlanReady?: (pages: import("@/types/page-plan").PagePlanItem[]) => void;
  /** 单页 SVG 就绪（含修复后覆盖）——D2 流式预览 */
  onPageReady?: (index: number, svg: string) => void;
  /** 模板生成上下文：约束 LLM 输出与模板页数/角色一致（P2 模板产品化） */
  templateCtx?: TemplateGenerationContext;
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

/** string[] -> BulletNode[] 的简单转换（仅在 pipeline 生成时使用） */
function bulletsToNodes(bullets: string[]): BulletNode[] {
  return bullets.map((text, i) => ({ id: `b${i}`, text, level: 0 }));
}
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
    templateCtx: options.templateCtx,
    options: options.options,
  });

  options.onPlanReady?.(plan);

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
        options.onPageReady?.(i, svg);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        failedPages.push(i);
        const err = e instanceof Error ? e : new Error(String(e));
        const keptOldSvg = Boolean(deck.slides?.[i]?.svg);
        options.onPageError?.(i, err, keptOldSvg);
      }
      options.onProgress?.(i + 1, total);
    }
  } else {
    pages = await generateDeckSvgs(plan, spec, {
      onProgress: options.onProgress,
      signal: options.signal,
      onPageReady: options.onPageReady,
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
      // 写入新 svg 即代表以 SVG 为当前真相，清除过期标记
      // 同步 plan 的结构化内容（bullets/quote/attribution），防止 pipeline 生成后字段丢失
      // bullets：有旧值则保持，无旧值则从 plan 注入；quote/attribution 有旧值则保持，无旧值则从 plan 注入
      slides[i] = page
        ? {
            ...slides[i],
            svg: page.svg,
            svgStale: false,
            title: plan[i].title,
            bullets:
              slides[i].bullets !== undefined
                ? slides[i].bullets
                : bulletsToNodes(plan[i].bullets ?? []),
            quote: slides[i].quote ?? plan[i].quote,
            attribution: slides[i].attribution ?? plan[i].attribution,
          }
        : slides[i];
    } else if (page) {
      slides.push({
        id: `s${i + 1}`,
        layout: semanticRoleToLayout(page.role),
        title: plan[i].title,
        svg: page.svg,
        bullets: bulletsToNodes(plan[i].bullets ?? []),
        quote: plan[i].quote,
        attribution: plan[i].attribution,
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
