import { chat, isLocalModelActive } from "@/services/llm";
import { useGenerationFollowStore } from "@/store/generation-follow";
import { buildSvgGenPrompt } from "@/services/llm/prompts/svg-gen";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";
import { validateSvgContract } from "./spec-contract";
import {
  checkSvg,
  checkContentPresence,
  checkChartData,
  svgContainsChart,
  checkCohortConsistency,
  checkPresetShapes,
  checkSvgIcons,
  checkTextGeometry,
  checkAesthetics,
  checkChartGeometry,
  checkVisualRhythm,
  autoPatchSvg,
} from "./quality/checker";
import { compactSvgOutput } from "./quality/compact";
import { finalizeSvgPresets } from "./presets";
import { finalizeSvgIcons } from "./icons";
import type { SvgPage } from "./types";

/** 进度回调：已完成页数、总页数 */
export type SvgProgress = (done: number, total: number) => void;

/** 每页 SVG 生成的软超时（不含 LLM 自身传输层重试），超时按单页失败抛出 */
const PAGE_TIME_LIMIT_MS = 90_000;

/**
 * 本地端侧模型档：低端 CPU 按 8–20 tok/s 产出约 2.5K token/页，
 * 单页预算放宽到 5 分钟，避免超时误杀正在推进的推理。
 */
const PAGE_TIME_LIMIT_LOCAL_MS = 300_000;

/**
 * 压缩回传给 LLM 的底稿 SVG（参照 PPT Master compact_svg_coordinates/styles）：
 * 去注释、折叠标签间空白与连续空白——不改变任何结构与文本内容，
 * 显著降低定向修改调用的输入 token。
 */
export function compactSvgForPrompt(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 将外部取消信号与超时合并为一个页面级 AbortSignal。
 * 超时或用户取消都会触发 abort，从而中断当页的 LLM 请求；
 * 超时与用户取消的区别在 rawGenerate 中区分（见 AbortError 分支）。
 */
function pageLevelSignal(
  signal: AbortSignal | undefined,
  timeLimitMs: number,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), timeLimitMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export interface GenerateSlideSvgOptions {
  specLock: SpecLock;
  plan: PagePlanItem;
  pageIndex: number;
  totalPages: number;
  signal?: AbortSignal;
  /** 该页必须完整呈现的内容素材（结构化编辑后的内容防丢失） */
  contentBrief?: string;
  /** 用户的定向修改指令（如「把主色改成蓝色」） */
  instruction?: string;
  /** 现有 SVG 底稿：提供时在其基础上修改而非从零重画 */
  baseSvg?: string;
  /** 正文页版式变体（0 整宽 / 1 双栏），由 generateDeckSvgs 按相邻同角色页轮换 */
  layoutVariant?: number;
}

/**
 * 生成单页「设计真相 SVG」。
 * 串行调用 chat，注入 specLock + pagePlan item，要求产出单个 <svg viewBox="0 0 1280 720">。
 * 集成质量闸门：首轮产出后若 checkSvg 报 error，则把问题回喂 chat 重画，最多 2 轮。
 * 循环结束后仍以 validateSvgContract 兜底，避免返回非法 svg（最后防线）。
 */
export async function generateSlideSvg(
  opts: GenerateSlideSvgOptions,
): Promise<string> {
  // 本地小模型档：精简设备菜单与词汇表，降低 prefill 开销
  const local = isLocalModelActive();
  const prompt = buildSvgGenPrompt({ ...opts, slim: local });
  // 有底稿的定向修改用低温度保证稳定；从零生成保持多样性
  const temperature = opts.baseSvg ? 0.4 : 0.7;
  const baseBlock = opts.baseSvg
    ? `\n\n以下是该页当前的 SVG 设计稿，请在其基础上修改（保持整体版式、元素结构与风格不变，仅落实上述要求），输出修改后的完整 SVG：\n${compactSvgForPrompt(opts.baseSvg)}`
    : "";

  // 页面级取消：合并用户取消信号 + 软超时（超时按取消处理）
  const timeLimitMs = local ? PAGE_TIME_LIMIT_LOCAL_MS : PAGE_TIME_LIMIT_MS;
  const pageLevel = pageLevelSignal(opts.signal, timeLimitMs);

  const rawGenerate = async (userContent: string): Promise<string> => {
    let res: Awaited<ReturnType<typeof chat>>;
    try {
      res = await chat(
        {
          messages: [
            {
              role: "system",
              content:
                "你产出单页 SVG，只返回 <svg> 根元素，不要任何解释或 markdown 包裹。",
            },
            { role: "user", content: userContent },
          ],
          temperature,
          maxTokens: 16000,
          signal: pageLevel.signal,
          // 本地档：逐 token 上屏，生成期间可见真实输出
          onPartial: local
            ? (text) =>
                useGenerationFollowStore.getState().setPartialText(text)
            : undefined,
        },
        "svg",
      );
    } catch (e) {
      // 页面级软超时触发的 abort 并非用户取消：转为普通页面错误抛出，
      // 否则 isolatePageFailures 会把超时误判为整体取消，中断整份 deck
      if (
        e instanceof DOMException &&
        e.name === "AbortError" &&
        !opts.signal?.aborted
      ) {
        throw new Error(
          `第 ${opts.pageIndex + 1} 页 SVG 生成超时（${timeLimitMs / 1000} 秒），请重试`,
        );
      }
      throw e;
    }
    // 剥离可能的 ```svg 代码块包裹，再提取 <svg>…</svg> 根元素
    const stripped = res.content
      .replace(/^```(?:svg|xml)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return stripped.match(/<svg[\s\S]*<\/svg>/i)?.[0] ?? stripped;
  };

  try {
    let svg = (await rawGenerate(prompt + baseBlock)).trim();

    const hasSvgRoot =
      /^<svg[\s\S]*<\/svg>$/i.test(svg) || /<svg[\s\S]*<\/svg>/i.test(svg);

    // 首轮若被截断（无完整 <svg> 根元素），先尝试让模型续写闭合，而不是直接判失败
    if (!hasSvgRoot) {
      svg = (
        await rawGenerate(
          prompt +
            baseBlock +
            "\n\n你上一次的输出被截断了，缺少完整的 <svg>…</svg>。请仅输出从 <svg 开始到 </svg> 结束的完整 SVG，不要任何解释或代码块包裹。",
        )
      ).trim();
    }

    // 闸门错误全集（含 brand）：结构契约 + 几何（含文本安全区/重叠）+ 图表/词表
    // + 内容必现。collectErrors 再剔除 brand（整份 deck 同现、逐页重画改不动）。
    const collectAllErrors = (s: string) =>
      [
        ...checkSvg(s, opts.specLock),
        // 文本几何：小模型最高频的两类崩坏（贴边溢出、文字互叠）
        ...checkTextGeometry(s, opts.specLock),
        // 量化美学：浅字压浅底等对比度塌陷（error 级）回喂重画
        ...checkAesthetics(s, opts.specLock),
        // 图表几何回算：手绘柱体与数据比例失真（error 级）回喂重画
        ...checkChartGeometry(s),
        // 图表数据完整性：LLM 声明了图表但数据缺失/损坏会在导出端静默丢图
        ...checkChartData(s),
        // 预设形状/图标词表：未知标记导出端会静默降级为矩形
        ...checkPresetShapes(s),
        ...checkSvgIcons(s),
        // 图表必现性：plan 要求图表页时，SVG 中必须出现原生图表标记
        ...(opts.plan.chartType && !svgContainsChart(s)
          ? [
              {
                severity: "error" as const,
                message: `图表缺失：该页计划要求 ${opts.plan.chartType} 图，但 SVG 中未出现 data-chart-type 标记`,
              },
            ]
          : []),
        // 内容必现性：标题/要点必须出现在 SVG 文本中，防止 LLM 丢字/改写关键内容
        ...checkContentPresence(s, {
          title: opts.plan.title,
          bullets: opts.plan.bullets,
        }),
      ].filter((i) => i.severity === "error");

    const collectErrors = (s: string) =>
      collectAllErrors(s).filter((i) => i.kind !== "brand");

    // 确定性原子修复（对标 §4.2/4.3）：非色板乱用色吸附回色板、CJK 字距移除。
    // 纯属性改写不动几何结构。保留条件：总误差数不升 **且 brand 级塌陷不增**——
    // 否则一次「把越位文字色吸附成 token」会把 page 塌陷翻成 brand，被
    // collectErrors 排除后假性归零，却在导出锁处把整份 deck hard 锁死。
    const patch = (s: string): string => {
      const { svg: p, changed } = autoPatchSvg(s, opts.specLock);
      if (changed === 0) return s;
      const before = collectAllErrors(s);
      const after = collectAllErrors(p);
      const brand = (arr: typeof before) =>
        arr.filter((i) => i.kind === "brand").length;
      const noWorse = after.length <= before.length;
      const noNewBrand = brand(after) <= brand(before);
      return noWorse && noNewBrand ? p : s;
    };

    // 修复环保留「最优候选」：末轮重画可能比前轮更差，取错误最少的一版
    svg = patch(svg);
    let best: { svg: string; errors: number } = {
      svg,
      errors: collectErrors(svg).length,
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (best.errors === 0) break;
      const issues = collectErrors(svg);
      // 软性节奏问题（字距/对齐/栅格）不单独触发重画；但本轮既然已在重画，
      // 顺手下发让模型一并改进——零额外成本地抬高视觉分。
      const rhythm = checkVisualRhythm(svg, opts.specLock);
      const feedback =
        "你的 SVG 有以下问题，请修正后重新输出完整 SVG：\n" +
        issues.map((i) => "- " + i.message).join("\n") +
        (rhythm.length
          ? "\n另有可顺手改进的排版节奏项（不强求）：\n" +
            rhythm.map((i) => "- " + i.message).join("\n")
          : "");
      svg = patch(
        (await rawGenerate(prompt + baseBlock + "\n\n" + feedback)).trim(),
      );
      const errors = collectErrors(svg).length;
      if (errors < best.errors) best = { svg, errors };
    }
    svg = best.svg;

    const errors = validateSvgContract(svg, opts.specLock.canvas);
    if (errors.length > 0) {
      throw new Error(
        `SVG 契约校验未通过（第 ${opts.pageIndex + 1} 页）：\n` +
          errors.map((e) => "- " + e).join("\n"),
      );
    }
    // 规范化标记元素：data-icon 展开为形状序列、data-prst → canonical path
    //（预览保真，导出走原生形状/prstGeom）；最后坐标取整 + 折叠空白，
    // 缩短存储/预览/导出底稿与「读回整页 SVG」类调用的输入 token。
    return compactSvgOutput(finalizeSvgPresets(finalizeSvgIcons(svg)));
  } finally {
    pageLevel.cleanup();
  }
}

export interface GenerateDeckSvgsOptions {
  onProgress?: SvgProgress;
  signal?: AbortSignal;
  /** 关闭 early gate（默认开启）。isolatePageFailures 隔离路径不经过此函数，天然不带门 */
  skipEarlyGate?: boolean;
  /** 单页 SVG 就绪（含修复后的覆盖）——D2 流式预览 */
  onPageReady?: (index: number, svg: string) => void;
}

/** early gate：cohort 页数阈值——先生成前 N 页并跑跨页一致性门（参照 PPT Master P01-P05 early gate） */
export const EARLY_GATE_PAGES = 5;

/**
 * 逐页串行生成整份 deck 的 SVG（禁止 Promise.all 并行）。
 * 三阶段：先生成前 EARLY_GATE_PAGES 页（cohort）→ 跨页一致性门
 * （颜色/字体越锁的页面基于底稿修复一次，并把一致性要求下发给剩余页）→
 * 生成剩余页。每生成一页调用一次 onProgress(done, total)。
 * signal 透传到每一页：取消时中断当前 LLM 请求并抛出 AbortError。
 */
export async function generateDeckSvgs(
  plan: PagePlanItem[],
  spec: SpecLock,
  opts?: GenerateDeckSvgsOptions,
): Promise<SvgPage[]> {
  const total = plan.length;
  const onProgress = opts?.onProgress;
  const signal = opts?.signal;
  const gateAt = Math.min(EARLY_GATE_PAGES, total);
  const pages: SvgPage[] = [];

  const { onPageReady } = opts ?? {};
  const generatePage = async (
    i: number,
    extra?: {
      baseSvg?: string;
      instruction?: string;
      extraGuidance?: string;
      layoutVariant?: number;
    },
  ): Promise<string> => {
    const svg = await generateSlideSvg({
      specLock: spec,
      plan: plan[i],
      pageIndex: i,
      totalPages: total,
      signal,
      ...extra,
    });
    onPageReady?.(i, svg);
    return svg;
  };

  // 跨页版式轮换：连续的同角色正文页交替使用整宽/双栏两种骨架（对标 deck 级
  // 多样性）。顺序生成、按页缓存，Phase 2 的整改重画复用同一变体不漂移。
  const variantCache = new Map<number, number | undefined>();
  const isPlainContent = (i: number) =>
    plan[i].role === "content" && !plan[i].chartType;
  const variantFor = (i: number): number | undefined => {
    if (variantCache.has(i)) return variantCache.get(i);
    let v: number | undefined;
    if (isPlainContent(i)) {
      const prevSame = i > 0 && isPlainContent(i - 1);
      v = prevSame ? 1 - (variantCache.get(i - 1) ?? 0) : 0;
    }
    variantCache.set(i, v);
    return v;
  };

  // Phase 1: cohort（前 gateAt 页）
  for (let i = 0; i < gateAt; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const svg = await generatePage(i, { layoutVariant: variantFor(i) });
    pages.push({ index: i, role: plan[i].role, svg });
    onProgress?.(i + 1, total);
  }

  // Phase 2: early gate —— cohort 一致性检查：错误页修复一次，全部问题下发剩余页
  let extraGuidance: string | undefined;
  if (!opts?.skipEarlyGate && pages.length > 0) {
    const cohortIssues = checkCohortConsistency(
      pages.map((p) => p.svg),
      spec,
    );
    const errors = cohortIssues.filter((i) => i.severity === "error");
    const warns = cohortIssues.filter((i) => i.severity === "warn");
    if (errors.length > 0 || warns.length > 0) {
      extraGuidance = [...errors, ...warns]
        .map((i) => "- " + i.message)
        .join("\n");
      for (let i = 0; i < pages.length; i++) {
        const own = checkCohortConsistency([pages[i].svg], spec).filter(
          (x) => x.severity === "error",
        );
        if (own.length === 0) continue;
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        pages[i] = {
          ...pages[i],
          svg: await generatePage(i, {
            baseSvg: pages[i].svg,
            layoutVariant: variantCache.get(i),
            instruction: `修正以下跨页一致性问题（保持版式与内容不变，仅落实要求）：\n${own
              .map((x) => "- " + x.message)
              .join("\n")}`,
          }),
        };
      }
    }
  }

  // Phase 3: 剩余页（携带 cohort 一致性纠正要求）
  for (let i = gateAt; i < total; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const svg = await generatePage(i, {
      extraGuidance,
      layoutVariant: variantFor(i),
    });
    pages.push({ index: i, role: plan[i].role, svg });
    onProgress?.(i + 1, total);
  }
  return pages;
}
