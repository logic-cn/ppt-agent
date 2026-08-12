import { create } from "zustand";
import type { Deck, Slide } from "@/types/deck";
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
      const snap = snapshot(s.deck);
      debouncedPersist(get);
      return {
        deck: s.deck ? { ...s.deck, design, updatedAt: Date.now() } : null,
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
              slides: s.deck.slides.map((sl) =>
                sl.id === id ? { ...sl, ...patch } : sl,
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

    // 复用既有 updateSlide 写回，保持历史/持久化一致
    get().updateSlide(slideId, { svg: newSvg });
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
