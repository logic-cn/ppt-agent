import { create } from "zustand";
import type { Deck, Slide } from "@/types/deck";
import { touchesSvgVisual } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { loadDeck, saveDeck, createEmptyDeck } from "@/services/storage";
import { clearRenderCache } from "@/engine/render-ir/build";
import { buildSpecLock } from "@/design/spec-lock";
import { generateSlideSvg } from "@/engine/svg/executor";
import type { PagePlanItem } from "@/types/page-plan";

interface HistoryEntry {
  deck: Deck;
}

interface DeckStore {
  deck: Deck | null;
  loading: boolean;
  dirty: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

  load: (id: string) => Promise<void>;
  createDeck: (title?: string) => Promise<Deck>;
  setTitle: (title: string) => void;
  setDesign: (design: DesignLock) => void;
  setSource: (source: Deck["source"]) => void;

  // 幻灯片操作（自动记录历史）
  addSlide: (slide: Deck["slides"][number]) => void;
  updateSlide: (id: string, patch: Partial<Deck["slides"][number]>) => void;
  removeSlide: (id: string) => void;
  moveSlide: (from: number, to: number) => void;
  replaceSlides: (slides: Deck["slides"]) => Promise<void>;
  /** D2 流式生成：静默更新单页 SVG（不产生历史条目；索引越界为 no-op） */
  updateSlideSvgLive: (index: number, svg: string) => void;
  setPlayback: (patch: {
    transition?: Deck["transition"];
    entranceAnimation?: boolean;
  }) => void;
  // 单页重画：基于当前 deck.design 重新生成该页 SVG 并写回
  regenerateSlide: (slideId: string, signal?: AbortSignal) => Promise<void>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;

  persist: () => Promise<void>;
}

function snapshot(deck: Deck | null): HistoryEntry | null {
  if (!deck) return null;
  clearRenderCache();
  return { deck: structuredClone(deck) };
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedPersist(get: () => DeckStore) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    get().persist();
  }, 2000);
}

// 关闭/刷新页面前尽力落盘防抖窗口内的改动（异步 IPC 尽力而为，与 30s 自动保存互补）
if (typeof window !== "undefined") {
  const flushOnHide = () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    const { deck, dirty } = useDeckStore.getState();
    if (dirty && deck) void saveDeck(deck).catch(() => {});
  };
  window.addEventListener("pagehide", flushOnHide);
}

// 把旧 SlideLayout 映射到 pagePlan 的语义角色（取交集，缺省归为 content）
const SEMANTIC_ROLE_SET = new Set([
  "cover",
  "section",
  "content",
  "metrics",
  "quote",
  "timeline",
  "comparison",
  "process",
  "closing",
]);

function toSemanticRole(layout: string): PagePlanItem["role"] {
  return SEMANTIC_ROLE_SET.has(layout)
    ? (layout as PagePlanItem["role"])
    : "content";
}

// 从 slide 收集要点文本（兼容 bullets / items 结构）
function collectBullets(slide: Slide): string[] {
  const out: string[] = [];
  if (Array.isArray(slide.bullets)) {
    const walk = (nodes: Slide["bullets"]): void => {
      for (const n of nodes ?? []) {
        if (n.text) out.push(n.text);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(slide.bullets);
  }
  if (Array.isArray(slide.items)) {
    for (const it of slide.items) {
      if (it.title) out.push(it.title);
      if (it.body) out.push(it.body);
      if (Array.isArray(it.bullets)) out.push(...it.bullets);
    }
  }
  return out;
}

export const useDeckStore = create<DeckStore>((set, get) => ({
  deck: null,
  loading: false,
  dirty: false,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  load: async (id) => {
    set({ loading: true });
    try {
      const deck = await loadDeck(id);
      if (deck) {
        clearRenderCache();
        set({ deck, loading: false, dirty: false, past: [], future: [] });
      } else {
        set({ deck: null, loading: false });
      }
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  createDeck: async (title) => {
    const deck = createEmptyDeck(title);
    await saveDeck(deck);
    clearRenderCache();
    set({ deck, dirty: false, past: [], future: [] });
    return deck;
  },

  setTitle: (title) => {
    set((s) => {
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck ? { ...s.deck, title, updatedAt: Date.now() } : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  setDesign: (design) => {
    set((s) => {
      // 同值重设：不记录历史、不标记过期，避免误报
      if (
        s.deck &&
        s.deck.design.mode === design.mode &&
        s.deck.design.visualStyle === design.visualStyle &&
        s.deck.design.palette === design.palette
      ) {
        return s;
      }
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              design,
              // 设计变更影响全部页的 SVG 视觉：带 svg 的页全部标记过期
              slides: s.deck.slides.map((sl) =>
                sl.svg ? { ...sl, svgStale: true } : sl,
              ),
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  updateSlideSvgLive: (index, svg) => {
    set((s) => {
      if (!s.deck || !s.deck.slides[index]) return s;
      debouncedPersist(get);
      return {
        deck: {
          ...s.deck,
          slides: s.deck.slides.map((sl, i) =>
            i === index ? { ...sl, svg, svgStale: false } : sl,
          ),
          updatedAt: Date.now(),
        },
        dirty: true,
      };
    });
  },

  /** 放映偏好（转场/入场动画，D1）：一次字段编辑合并为一次历史 */
  setPlayback: (patch: {
    transition?: Deck["transition"];
    entranceAnimation?: boolean;
  }) => {
    set((s) => {
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              transition: patch.transition ?? s.deck.transition,
              entranceAnimation:
                patch.entranceAnimation ?? s.deck.entranceAnimation,
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  setSource: (source) => {
    set((s) => {
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck ? { ...s.deck, source, updatedAt: Date.now() } : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  addSlide: (slide) => {
    set((s) => {
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              slides: [...s.deck.slides, slide],
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  updateSlide: (id, patch) => {
    set((s) => {
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              slides: s.deck.slides.map((sl) => {
                if (sl.id !== id) return sl;
                const next = { ...sl, ...patch };
                if ("svgStale" in patch) {
                  // 调用方显式指定（如重画写回 {svg, svgStale:false}）：直接采用
                  next.svgStale = patch.svgStale;
                } else if (sl.svg && touchesSvgVisual(patch)) {
                  // 编辑了影响 SVG 视觉的结构化字段且该页已有 SVG → 标记过期
                  next.svgStale = true;
                } else if ("svg" in patch && !next.svg) {
                  // SVG 被清空：过期标记随之清除
                  next.svgStale = undefined;
                }
                return next;
              }),
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  removeSlide: (id) => {
    set((s) => {
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck
          ? {
              ...s.deck,
              slides: s.deck.slides.filter((sl) => sl.id !== id),
              updatedAt: Date.now(),
            }
          : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  moveSlide: (from, to) => {
    set((s) => {
      if (!s.deck) return s;
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      const slides = [...s.deck.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return {
        deck: { ...s.deck, slides, updatedAt: Date.now() },
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  replaceSlides: async (slides) => {
    set((s) => {
      const snap = snapshot(s.deck);
      return {
        deck: s.deck ? { ...s.deck, slides, updatedAt: Date.now() } : null,
        dirty: true,
        past: snap ? [...s.past.slice(-49), snap] : s.past,
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
    await get().persist();
  },

  // 由 slide 自身信息派生一个最小合理的 PagePlanItem，供 executor 重画使用
  regenerateSlide: async (slideId, signal) => {
    const deck = get().deck;
    if (!deck) return;
    const slideIndex = deck.slides.findIndex((s) => s.id === slideId);
    if (slideIndex < 0) return;
    const slide = deck.slides[slideIndex];

    // 构建 specLock（复用既有设计契约构建器）
    const specLock = buildSpecLock(deck.design);

    // 从 slide 派生 pagePlan：role 取 layout（落到语义角色集合内），
    // 否则回退为 content；bullets 尽量取 slide 要点
    const role = toSemanticRole(slide.layout);
    const bullets = collectBullets(slide);
    const plan: PagePlanItem = {
      role,
      title: slide.title || `${deck.title}（第 ${slideIndex + 1} 页）`,
      intent: slide.title || slide.subtitle || "重画该页内容",
      bullets,
      ...(slide.chart?.data.length ? { chartType: slide.chart.type } : {}),
    };

    // 内容素材：重画时保证结构化编辑后的内容不丢失
    const briefParts: string[] = [];
    if (slide.subtitle) briefParts.push(`副标题：${slide.subtitle}`);
    if (slide.body) briefParts.push(`正文：${slide.body}`);
    if (slide.metric) {
      briefParts.push(
        `核心指标：${slide.metric.value}${slide.metric.unit ?? ""}` +
          (slide.metric.kicker ? `（${slide.metric.kicker}）` : "") +
          `，说明：${slide.metric.label}`,
      );
    }
    if (slide.quote) briefParts.push(`引言：${slide.quote}`);
    if (slide.chart?.data.length) {
      const chartTitle = slide.chart.title
        ? `，标题：${slide.chart.title}`
        : "";
      briefParts.push(
        `图表（${slide.chart.type}${chartTitle}，必须使用以下数据）：\n` +
          slide.chart.data.map((d) => `- ${d.label}: ${d.value}`).join("\n"),
      );
    }
    if (bullets.length) {
      briefParts.push(`要点列表：\n${bullets.map((b) => `- ${b}`).join("\n")}`);
    }

    // 真实调用 LLM（测试时由 vi.mock 的 executor 替代）
    const newSvg = await generateSlideSvg({
      specLock,
      plan,
      pageIndex: slideIndex,
      totalPages: deck.slides.length,
      signal,
      // 有旧 SVG 时在其基础上修改，保持版式与风格稳定
      baseSvg: slide.svg,
      contentBrief: briefParts.join("\n") || undefined,
    });

    // 复用既有 updateSlide 写回，保持历史/持久化一致；同时清除过期标记
    get().updateSlide(slideId, { svg: newSvg, svgStale: false });
  },

  undo: () => {
    const { past, deck } = get();
    if (past.length === 0 || !deck) return;
    clearRenderCache();
    const entry = past[past.length - 1];
    const newPast = past.slice(0, -1);
    debouncedPersist(get);
    set({
      deck: {
        ...JSON.parse(JSON.stringify(entry.deck)),
        updatedAt: Date.now(),
      },
      past: newPast,
      future: [...get().future, { deck: JSON.parse(JSON.stringify(deck)) }],
      canUndo: newPast.length > 0,
      canRedo: true,
      dirty: true,
    });
  },

  redo: () => {
    const { future, deck } = get();
    if (future.length === 0 || !deck) return;
    clearRenderCache();
    const entry = future[future.length - 1];
    const newFuture = future.slice(0, -1);
    debouncedPersist(get);
    set({
      deck: {
        ...JSON.parse(JSON.stringify(entry.deck)),
        updatedAt: Date.now(),
      },
      past: [...get().past, { deck: JSON.parse(JSON.stringify(deck)) }],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      dirty: true,
    });
  },

  persist: async () => {
    const { deck } = get();
    if (!deck) return;
    await saveDeck(deck);
    set({ dirty: false });
  },
}));
