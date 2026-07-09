import PptxGenJS from "pptxgenjs";
import type { Deck, Slide, BulletNode } from "@/types/deck";
import type { Theme } from "@/types/theme";
import { resolveTheme } from "@/themes";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export async function exportDeck(deck: Deck, path: string): Promise<void> {
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    renderSlide(s, slide, theme);
  }
  await pptx.writeFile({ fileName: path });
}

export async function exportDeckToBlob(deck: Deck): Promise<Blob> {
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    renderSlide(s, slide, theme);
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}

function initPptx(pptx: PptxGenJS) {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}

function renderSlide(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const layout = theme.layouts[slide.layout];
  if (!layout) return;

  s.background = { fill: theme.colors.background };

  // 装饰色带
  if (
    slide.layout === "cover" ||
    slide.layout === "section" ||
    slide.layout === "closing"
  ) {
    s.addShape("rect", {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: 0.35,
      fill: { color: theme.colors.primary },
      line: { width: 0 },
    });
  }

  // cover 右色块
  if (slide.layout === "cover") {
    s.addShape("rect", {
      x: SLIDE_W * 0.7,
      y: 0,
      w: SLIDE_W * 0.3,
      h: SLIDE_H,
      fill: { color: theme.colors.surface },
      line: { width: 0 },
    });
  }

  // 标题
  if (layout.title && slide.title) {
    addText(s, slide.title, layout.title, {
      fontSize: theme.fontSize.h1 * 0.45,
      fontFace: theme.fonts.title,
      color: theme.colors.primary,
      bold: true,
      align: slide.layout === "closing" ? "center" : "left",
    });
  }

  // 副标题
  if (layout.title && slide.subtitle) {
    addText(
      s,
      slide.subtitle,
      {
        x: layout.title.x,
        y: layout.title.y + layout.title.h * 0.55,
        w: layout.title.w,
        h: layout.title.h * 0.4,
      },
      {
        fontSize: theme.fontSize.body * 0.45,
        fontFace: theme.fonts.body,
        color: theme.colors.textMuted,
      },
    );
  }

  // 正文 / bullets
  if (layout.body) {
    if (slide.bullets && slide.bullets.length > 0) {
      const bulletText = flattenBullets(slide.bullets);
      addText(s, bulletText, layout.body, {
        fontSize: theme.fontSize.body * 0.45,
        fontFace: theme.fonts.body,
        color: theme.colors.text,
        valign: "top",
        align: "left",
        lineSpacingMultiple: 1.5,
        bullet: { code: "25CF", color: theme.colors.accent },
      });
    } else if (slide.body) {
      addText(s, slide.body, layout.body, {
        fontSize: theme.fontSize.body * 0.45,
        fontFace: theme.fonts.body,
        color: theme.colors.text,
        valign: "top",
      });
    }
  }

  // 图表
  if (slide.chart && layout.visual) {
    const chartData = [
      {
        name: slide.chart.title ?? "数据",
        labels: slide.chart.data.map((d) => d.label),
        values: slide.chart.data.map((d) => d.value),
      },
    ];
    const chartOpts: Record<string, unknown> = {
      x: layout.visual.x * SLIDE_W,
      y: layout.visual.y * SLIDE_H,
      w: layout.visual.w * SLIDE_W,
      h: layout.visual.h * SLIDE_H,
      showLegend: true,
      showTitle: false,
      chartColors: [
        theme.colors.accent,
        theme.colors.secondary,
        theme.colors.primary,
      ],
    };
    s.addChart(
      slide.chart.type as "bar" | "pie" | "line" | "doughnut",
      chartData,
      chartOpts,
    );
  }
}

function addText(
  s: PptxGenJS.Slide,
  text: string,
  area: { x: number; y: number; w: number; h: number },
  opts: Record<string, unknown>,
) {
  s.addText(text, {
    x: area.x * SLIDE_W,
    y: area.y * SLIDE_H,
    w: area.w * SLIDE_W,
    h: area.h * SLIDE_H,
    autoFit: true,
    ...opts,
  });
}

function flattenBullets(nodes: BulletNode[]): string {
  const lines: string[] = [];
  const walk = (items: BulletNode[], level: number) => {
    for (const item of items) {
      lines.push(item.text);
      if (item.children) walk(item.children, level + 1);
    }
  };
  walk(nodes, 0);
  return lines.join("\n");
}
