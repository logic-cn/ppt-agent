import type { Deck, Slide } from "@/types/deck";
import type { Theme, LayoutSpec } from "@/types/theme";
import type {
  RenderSlide,
  RenderNode,
  RenderTextNode,
  RenderShapeNode,
  Rect,
} from "./types";
import { getColumnRects, isColsLayout, getColCount } from "./layout";
import { resolveTextStyle, getOverflow } from "./text";
import { getLayoutRects } from "../layout-geometry";

export function buildRenderSlides(deck: Deck, theme: Theme): RenderSlide[] {
  return deck.slides.map((slide) => buildRenderSlide(slide, deck, theme));
}

// ── per-slide 渲染缓存 ──────────────────────────────────────────
// 消除预览与缩略图对同一页重复构建 RenderIR 的开销
const renderCache = new Map<string, RenderSlide>();

export function clearRenderCache(): void {
  renderCache.clear();
}

export function buildRenderSlideCached(
  slide: Slide,
  deck: Deck,
  theme: Theme,
): RenderSlide {
  const key = `${slide.id}::${theme.id}`;
  let rs = renderCache.get(key);
  if (!rs) {
    rs = buildRenderSlide(slide, deck, theme);
    renderCache.set(key, rs);
  }
  return rs;
}

export function buildRenderSlide(
  slide: Slide,
  _deck: Deck,
  theme: Theme,
): RenderSlide {
  const nodes: RenderNode[] = [];
  const layout = getLayoutRects(slide.layout);
  if (!layout) {
    return {
      id: slide.id,
      background: theme.colors.background,
      nodes,
      notes: slide.notes,
    };
  }

  // 语义化专用布局：独立渲染分支
  if (slide.layout === "metrics") {
    return buildMetricsSlide(slide, theme, layout);
  }
  if (slide.layout === "quote") {
    return buildQuoteSlide(slide, theme, layout);
  }
  if (slide.layout === "timeline") {
    return buildTimelineSlide(slide, theme, layout);
  }

  // 背景
  const background = theme.colors.background;

  // 背景网格（科技/工程风）
  nodes.push(...buildGridBackground(theme));

  // 装饰：封面/章节/结尾用 coverAccent，正文用 bodyAccent
  if (
    slide.layout === "cover" ||
    slide.layout === "section" ||
    slide.layout === "closing"
  ) {
    nodes.push(...buildCoverDecor(theme));
  } else {
    nodes.push(...buildBodyDecor(theme));
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
  // 图表让区：布局无 visual 区（如正文）但 slide.chart 存在时，图表落到
  // 下半区默认矩形，正文相应收窄——否则检查器允许添加的图表在预览与导出
  // 中都不可见（死数据）。预览与导出共享本 builder，两端口径天然一致。
  const chartRect: Rect | undefined =
    layout.visual ??
    (slide.chart ? { x: 0.08, y: 0.46, w: 0.84, h: 0.46 } : undefined);
  const bodyClamp =
    slide.chart && !layout.visual && layout.body
      ? { ...layout.body, h: Math.max(0.45 - layout.body.y, 0.12) }
      : layout.body;
  if (
    (isColsLayout(slide.layout) || slide.layout === "two-column") &&
    slide.items &&
    slide.items.length > 0
  ) {
    const colCount =
      slide.layout === "two-column" ? 2 : getColCount(slide.layout);
    const hasVisual = !!(slide.chart || slide.image);
    // two-column 对比两组内容且无图表时，items 铺满整行正文区；
    // 若同时有图表/图片，items 限制在 body 区域，避免与 visual 重叠。
    const area: Rect =
      slide.layout === "two-column" && !hasVisual
        ? { x: 0.08, y: 0.22, w: 0.84, h: 0.7 }
        : (bodyClamp ?? { x: 0.08, y: 0.22, w: 0.84, h: 0.7 });
    buildColumns(nodes, slide.items.slice(0, colCount), area, colCount, theme);
  } else if (bodyClamp) {
    if (slide.bullets && slide.bullets.length > 0) {
      nodes.push(
        buildBulletTextNode("slide-body", slide.bullets, bodyClamp, theme),
      );
    } else if (slide.body) {
      nodes.push(
        buildTextNode(
          "slide-body",
          slide.body,
          bodyClamp,
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
  if (slide.chart && chartRect) {
    nodes.push({
      type: "chart",
      id: "slide-chart",
      rect: chartRect,
      chart: slide.chart,
      style: {
        showLegend: true,
        showTitle: !!slide.chart.title,
        colors: [
          theme.colors.accent,
          theme.colors.secondary,
          theme.colors.primary,
        ],
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
    radius: theme.decor?.accentRadius ?? 0.002,
    zIndex: 10,
  };
}

/** 封面/章节/结尾页的强调装饰，按主题 decor.coverAccent 分发 */
function buildCoverDecor(theme: Theme): RenderShapeNode[] {
  const accent = theme.decor?.coverAccent ?? "top-bar";
  const radius = theme.decor?.accentRadius ?? 0.002;
  switch (accent) {
    case "side-bar":
      return [
        {
          ...buildSideBar(theme),
          id: "deco-cover-side",
          rect: { x: 0.06, y: 0.18, w: 0.008, h: 0.64 },
        },
      ];
    case "corner":
      return [
        {
          type: "shape",
          id: "deco-cover-corner",
          shape: "rect",
          rect: { x: 0.08, y: 0.28, w: 0.09, h: 0.014 },
          fill: theme.colors.accent,
          radius,
          zIndex: 10,
        },
      ];
    case "none":
      return [];
    case "top-bar":
    default:
      return [buildTopBar(theme)];
  }
}

/** 正文页左侧栏目装饰，按主题 decor.bodyAccent 分发 */
function buildBodyDecor(theme: Theme): RenderShapeNode[] {
  const accent = theme.decor?.bodyAccent ?? "side-bar";
  if (accent === "none") return [];
  return [buildSideBar(theme)];
}

/** 科技/工程风的背景网格点阵 */
function buildGridBackground(theme: Theme): RenderShapeNode[] {
  if (!theme.decor?.grid) return [];
  const nodes: RenderShapeNode[] = [];
  const step = 0.05;
  for (let y = step; y < 1; y += step) {
    for (let x = step; x < 1; x += step) {
      nodes.push({
        type: "shape",
        id: `grid-${x.toFixed(2)}-${y.toFixed(2)}`,
        shape: "circle",
        rect: { x: x - 0.0015, y: y - 0.0015, w: 0.003, h: 0.003 },
        fill: theme.colors.secondary,
        zIndex: 0,
      });
    }
  }
  return nodes;
}

function buildSeparator(
  rect: Rect,
  y: number,
  theme: Theme,
): RenderShapeNode[] {
  if (theme.decor?.separator === "none") return [];
  return [
    {
      type: "shape",
      id: `sep-${rect.x}-${y}`,
      shape: "line",
      rect: { x: rect.x, y, w: rect.w, h: 0 },
      stroke: theme.colors.secondary,
      zIndex: 1,
    },
  ];
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
      nodes.push(
        ...buildSeparator(col, titleRect.y + titleRect.h + 0.005, theme),
      );
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
  role: "title" | "subtitle" | "body" | "caption",
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

// ── 语义化专用布局 ──────────────────────────────────────────

function buildMetricsSlide(
  slide: Slide,
  theme: Theme,
  layout: LayoutSpec,
): RenderSlide {
  const nodes: RenderNode[] = [
    ...buildGridBackground(theme),
    ...buildCoverDecor(theme),
  ];
  if (layout.title && slide.title) {
    nodes.push(
      buildTextNode(
        "slide-title",
        slide.title,
        layout.title,
        resolveTextStyle({
          fontSize: theme.fontSize.h2,
          fontFamily: theme.fonts.title,
          color: theme.colors.textMuted,
          bold: true,
          align: "center",
        }),
        "subtitle",
      ),
    );
  }
  if (layout.metric && slide.metric) {
    const m = slide.metric;
    const metricText =
      (m.kicker ? `${m.kicker}\n` : "") +
      `${m.value}${m.unit ? " " + m.unit : ""}`;
    nodes.push(
      buildTextNode(
        "slide-metric",
        metricText,
        layout.metric,
        resolveTextStyle({
          fontSize: Math.round(theme.fontSize.h1 * 2.4),
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          bold: true,
          align: "center",
        }),
        "caption",
      ),
    );
  }
  if (layout.body && slide.metric?.label) {
    nodes.push(
      buildTextNode(
        "slide-metric-label",
        slide.metric.label,
        layout.body,
        resolveTextStyle({
          fontSize: theme.fontSize.body + 2,
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
          align: "center",
        }),
        "body",
      ),
    );
  }
  return {
    id: slide.id,
    background: theme.colors.background,
    nodes,
    notes: slide.notes,
  };
}

function buildQuoteSlide(
  slide: Slide,
  theme: Theme,
  layout: LayoutSpec,
): RenderSlide {
  const nodes: RenderNode[] = [
    ...buildGridBackground(theme),
    ...buildCoverDecor(theme),
  ];
  if (layout.quote && slide.quote) {
    nodes.push(
      buildTextNode(
        "slide-quote",
        slide.quote,
        layout.quote,
        resolveTextStyle({
          fontSize: Math.round(theme.fontSize.h1 * 1.1),
          fontFamily: theme.fonts.title,
          color: theme.colors.text,
          bold: true,
          align: "center",
        }),
        "caption",
      ),
    );
  }
  if (layout.attribution && slide.attribution) {
    nodes.push(
      buildTextNode(
        "slide-attribution",
        slide.attribution,
        layout.attribution,
        resolveTextStyle({
          fontSize: theme.fontSize.caption,
          fontFamily: theme.fonts.body,
          color: theme.colors.textMuted,
          align: "center",
        }),
        "caption",
      ),
    );
  }
  return {
    id: slide.id,
    background: theme.colors.background,
    nodes,
    notes: slide.notes,
  };
}

function buildTimelineSlide(
  slide: Slide,
  theme: Theme,
  layout: LayoutSpec,
): RenderSlide {
  const nodes: RenderNode[] = [
    ...buildGridBackground(theme),
    ...buildBodyDecor(theme),
  ];
  if (layout.title && slide.title) {
    nodes.push(
      buildTextNode(
        "slide-title",
        slide.title,
        layout.title,
        resolveTextStyle({
          fontSize: theme.fontSize.h1,
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          bold: true,
        }),
        "title",
      ),
    );
  }
  // 时间轴基线
  if (layout.timeline) {
    nodes.push({
      type: "shape",
      id: "timeline-axis",
      shape: "line",
      rect: layout.timeline,
      stroke: theme.colors.secondary,
      zIndex: 2,
    });
  }
  // 节点：取 items（最多 5 个），沿轴线均分
  const items = (slide.items ?? []).slice(0, 5);
  const n = items.length;
  if (layout.timeline && n > 0) {
    const axis = layout.timeline;
    const step = axis.w / n;
    items.forEach((item, i) => {
      const cx = axis.x + step * (i + 0.5);
      // 节点圆点
      nodes.push({
        type: "shape",
        id: `timeline-dot-${i}`,
        shape: "circle",
        rect: { x: cx - 0.012, y: axis.y - 0.008, w: 0.024, h: 0.024 },
        fill: theme.colors.accent,
        zIndex: 3,
      });
      // 节点标题（轴上方，预留与轴线的间距）
      nodes.push(
        buildTextNode(
          `timeline-title-${i}`,
          item.title ?? "",
          {
            x: cx - step / 2 + 0.01,
            y: axis.y - 0.135,
            w: step - 0.02,
            h: 0.1,
          },
          resolveTextStyle({
            fontSize: theme.fontSize.h2 - 4,
            fontFamily: theme.fonts.title,
            color: theme.colors.primary,
            bold: true,
            align: "center",
          }),
          "body",
        ),
      );
      // 节点描述（轴下方，限高避免与底部 body 区重叠）
      const desc = item.body ?? (item.bullets ? item.bullets.join("；") : "");
      if (desc) {
        nodes.push(
          buildTextNode(
            `timeline-desc-${i}`,
            desc,
            {
              x: cx - step / 2 + 0.01,
              y: axis.y + 0.02,
              w: step - 0.02,
              h: 0.12,
            },
            resolveTextStyle({
              fontSize: theme.fontSize.caption,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              align: "center",
            }),
            "caption",
          ),
        );
      }
    });
  }
  return {
    id: slide.id,
    background: theme.colors.background,
    nodes,
    notes: slide.notes,
  };
}
