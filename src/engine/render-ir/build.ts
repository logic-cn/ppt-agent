import type { Deck, Slide } from "@/types/deck";
import type { Theme } from "@/types/theme";
import type {
  RenderSlide,
  RenderNode,
  RenderTextNode,
  RenderShapeNode,
  Rect,
} from "./types";
import { getColumnRects, isColsLayout, getColCount } from "./layout";
import { resolveTextStyle, getOverflow } from "./text";

export function buildRenderSlides(deck: Deck, theme: Theme): RenderSlide[] {
  return deck.slides.map((slide) => buildRenderSlide(slide, deck, theme));
}

function buildRenderSlide(
  slide: Slide,
  _deck: Deck,
  theme: Theme,
): RenderSlide {
  const nodes: RenderNode[] = [];
  const layout = theme.layouts[slide.layout];
  if (!layout) {
    return { id: slide.id, background: theme.colors.background, nodes, notes: slide.notes };
  }

  // 背景
  const background = theme.colors.background;

  // 装饰色带
  if (slide.layout === "cover" || slide.layout === "section" || slide.layout === "closing") {
    nodes.push(buildTopBar(theme));
  } else {
    nodes.push(buildSideBar(theme));
  }

  // 标题
  if (layout.title && slide.title) {
    nodes.push(
      buildTextNode(
        "slide-title",
        slide.title,
        layout.title,
        resolveTextStyle(
          {
            fontSize: theme.fontSize.h1,
            fontFamily: theme.fonts.title,
            color: theme.colors.primary,
            bold: true,
          },
          slide.layout === "closing" ? { align: "center" } : undefined,
        ),
        "title",
      ),
    );
  }

  // 副标题
  if (layout.title && slide.subtitle) {
    nodes.push(
      buildTextNode(
        "slide-subtitle",
        slide.subtitle,
        {
          x: layout.title.x,
          y: layout.title.y + layout.title.h * 0.55,
          w: layout.title.w,
          h: layout.title.h * 0.4,
        },
        resolveTextStyle({
          fontSize: theme.fontSize.body,
          fontFamily: theme.fonts.body,
          color: theme.colors.textMuted,
        }),
        "subtitle",
      ),
    );
  }

  // 正文 / bullets / items
  if (
    (isColsLayout(slide.layout) || slide.layout === "two-column") &&
    slide.items &&
    slide.items.length > 0
  ) {
    const colCount = slide.layout === "two-column" ? 2 : getColCount(slide.layout);
    const hasVisual = !!(slide.chart || slide.image);
    // two-column 对比两组内容且无图表时，items 铺满整行正文区；
    // 若同时有图表/图片，items 限制在 body 区域，避免与 visual 重叠。
    const area: Rect =
      slide.layout === "two-column" && !hasVisual
        ? { x: 0.08, y: 0.22, w: 0.84, h: 0.7 }
        : (layout.body ?? { x: 0.08, y: 0.22, w: 0.84, h: 0.7 });
    buildColumns(nodes, slide.items.slice(0, colCount), area, colCount, theme);
  } else if (layout.body) {
    if (slide.bullets && slide.bullets.length > 0) {
      nodes.push(
        buildBulletTextNode(
          "slide-body",
          slide.bullets,
          layout.body,
          theme,
        ),
      );
    } else if (slide.body) {
      nodes.push(
        buildTextNode(
          "slide-body",
          slide.body,
          layout.body,
          resolveTextStyle({
            fontSize: theme.fontSize.body,
            fontFamily: theme.fonts.body,
            color: theme.colors.text,
          }),
          "body",
        ),
      );
    }
  }

  // 图表
  if (slide.chart && layout.visual) {
    nodes.push({
      type: "chart",
      id: "slide-chart",
      rect: layout.visual,
      chart: slide.chart,
      style: {
        showLegend: true,
        showTitle: !!slide.chart.title,
        colors: [theme.colors.accent, theme.colors.secondary, theme.colors.primary],
      },
      zIndex: 1,
    });
  }

  // 图片
  if (slide.image && layout.visual) {
    nodes.push({
      type: "image",
      id: "slide-image",
      rect: layout.visual,
      src: slide.image.url,
      alt: slide.image.alt,
      fit: "cover",
      zIndex: 1,
    });
  }

  return {
    id: slide.id,
    background,
    nodes,
    notes: slide.notes,
    sourceRefs: slide.sourceRefs,
  };
}

function buildTopBar(theme: Theme): RenderShapeNode {
  return {
    type: "shape",
    id: "deco-top-bar",
    shape: "rect",
    rect: { x: 0, y: 0, w: 1, h: 0.047 },
    fill: theme.colors.primary,
    zIndex: 10,
  };
}

function buildSideBar(theme: Theme): RenderShapeNode {
  return {
    type: "shape",
    id: "deco-side-bar",
    shape: "rect",
    rect: { x: 0, y: 0.1, w: 0.005, h: 0.8 },
    fill: theme.colors.primary,
    radius: 0.002,
    zIndex: 10,
  };
}

function buildSeparator(rect: Rect, y: number, theme: Theme): RenderShapeNode {
  return {
    type: "shape",
    id: `sep-${rect.x}-${y}`,
    shape: "line",
    rect: { x: rect.x, y, w: rect.w, h: 0 },
    stroke: theme.colors.secondary,
    zIndex: 1,
  };
}

function buildColumns(
  nodes: RenderNode[],
  items: NonNullable<Slide["items"]>,
  area: Rect,
  colCount: number,
  theme: Theme,
): void {
  const colRects = getColumnRects(area, colCount);
  items.forEach((item, i) => {
    const col = colRects[i];
    const titleRect: Rect = { x: col.x, y: col.y, w: col.w, h: 0.08 };
    if (item.title) {
      nodes.push(
        buildTextNode(
          `col-${i}-title`,
          item.title,
          titleRect,
          resolveTextStyle({
            fontSize: theme.fontSize.h2 - 2,
            fontFamily: theme.fonts.title,
            color: theme.colors.primary,
            bold: true,
          }),
          "body",
        ),
      );
      nodes.push(buildSeparator(col, titleRect.y + titleRect.h + 0.005, theme));
    }
    const bulletArea: Rect = {
      x: col.x,
      y: col.y + (item.title ? titleRect.h + 0.015 : 0),
      w: col.w,
      h: col.h - (item.title ? titleRect.h + 0.015 : 0),
    };
    if (item.bullets && item.bullets.length > 0) {
      nodes.push(
        buildBulletTextNode(
          `col-${i}-bullets`,
          item.bullets.map((b) => ({ text: b, level: 0 })),
          bulletArea,
          theme,
        ),
      );
    } else if (item.body) {
      nodes.push(
        buildTextNode(
          `col-${i}-body`,
          item.body,
          bulletArea,
          resolveTextStyle({
            fontSize: theme.fontSize.body - 1,
            fontFamily: theme.fonts.body,
            color: theme.colors.text,
          }),
          "body",
        ),
      );
    }
  });
}

function buildTextNode(
  id: string,
  text: string,
  rect: Rect,
  style: ReturnType<typeof resolveTextStyle>,
  role: "title" | "subtitle" | "body",
): RenderTextNode {
  return {
    type: "text",
    id,
    text,
    rect,
    style,
    overflow: getOverflow(role),
    zIndex: 5,
  };
}

function buildBulletTextNode(
  id: string,
  bullets: { text: string; level: number }[],
  rect: Rect,
  theme: Theme,
): RenderTextNode {
  const bulletText = bullets
    .map((b) => `${"  ".repeat(b.level)}• ${b.text}`)
    .join("\n");
  return {
    type: "text",
    id,
    text: bulletText,
    rect,
    style: resolveTextStyle({
      fontSize: theme.fontSize.body,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    }),
    overflow: "fit",
    zIndex: 5,
  };
}
