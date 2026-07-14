import { DEFAULT_DESIGN, isDesignLock } from "@/types/design";
import { getPalette } from "@/design/palettes";
import type { ValidDeck } from "./deck-schema";

export interface RepairResult {
  deck: ValidDeck;
  warnings: string[];
}

export function repairDeck(input: unknown): RepairResult {
  const warnings: string[] = [];
  const deck = input as Record<string, unknown>;

  const design: ValidDeck["design"] = isDesignLock(deck.design)
    ? deck.design
    : {
        ...DEFAULT_DESIGN,
        palette: ensureString(deck.themeId) || DEFAULT_DESIGN.palette,
      };

  const repaired: ValidDeck = {
    id: ensureString(deck.id) || crypto.randomUUID(),
    version: (deck.version as number) || 2,
    title: ensureString(deck.title) || "未命名项目",
    design,
    slides: Array.isArray(deck.slides)
      ? deck.slides.map((s) =>
          repairSlide(s as Record<string, unknown>, warnings),
        )
      : [],
    createdAt: (deck.createdAt as number) || Date.now(),
    updatedAt: (deck.updatedAt as number) || Date.now(),
  };

  // 自定义配色(custom-*) 在 Editor 加载后由 getPalette 解析；此处不回退，
  // 交由 resolveTheme 的统一兜底处理，避免持久化的自定义配色被静默重置。
  const isCustomPalette = design.palette.startsWith("custom-");
  if (!isCustomPalette && !getPalette(design.palette)) {
    design.palette = DEFAULT_DESIGN.palette;
    warnings.push("design.palette 无效，已回退默认配色");
  }

  if (deck.source && typeof deck.source === "object") {
    repaired.source = deck.source as {
      type: "topic" | "doc" | "url";
      ref: string;
    };
  }

  if (!isDesignLock(deck.design)) {
    warnings.push("缺少 design，已回退到默认设计");
  }

  return { deck: repaired, warnings };
}

function repairSlide(
  slide: Record<string, unknown>,
  warnings: string[],
): ValidDeck["slides"][number] {
  const validLayouts = [
    "cover",
    "section",
    "content",
    "two-column",
    "chart",
    "image",
    "closing",
    "cols-2",
    "cols-3",
    "cols-4",
    "cols-5",
    "cols-6",
  ];

  let layout = ensureString(slide.layout);
  if (!layout || !validLayouts.includes(layout)) {
    warnings.push(
      `页面「${slide.title || "无标题"}」布局无效，已回退到 content`,
    );
    layout = "content";
  }

  const repaired: ValidDeck["slides"][number] = {
    id: ensureString(slide.id) || crypto.randomUUID(),
    layout: layout as ValidDeck["slides"][number]["layout"],
    title: ensureString(slide.title) || "",
  };

  if (slide.subtitle) repaired.subtitle = ensureString(slide.subtitle);
  if (slide.body) repaired.body = ensureString(slide.body);
  if (slide.notes) repaired.notes = ensureString(slide.notes);

  if (Array.isArray(slide.bullets)) {
    repaired.bullets = slide.bullets as ValidDeck["slides"][number]["bullets"];
  }
  if (Array.isArray(slide.items)) {
    repaired.items = slide.items as ValidDeck["slides"][number]["items"];
  }
  if (Array.isArray(slide.elements)) {
    repaired.elements =
      slide.elements as ValidDeck["slides"][number]["elements"];
  }

  if (slide.chart && typeof slide.chart === "object") {
    const chart = slide.chart as Record<string, unknown>;
    if (!Array.isArray(chart.data) || chart.data.length === 0) {
      warnings.push(`页面「${repaired.title}」图表数据无效，已移除图表`);
    } else {
      repaired.chart = slide.chart as ValidDeck["slides"][number]["chart"];
    }
  }

  if (slide.image && typeof slide.image === "object") {
    repaired.image = slide.image as ValidDeck["slides"][number]["image"];
  }

  if (Array.isArray(slide.sourceRefs)) {
    repaired.sourceRefs =
      slide.sourceRefs as ValidDeck["slides"][number]["sourceRefs"];
  }

  return repaired;
}

function ensureString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
}
