import PptxGenJS from "pptxgenjs";
import type { Deck, Slide, BulletNode, ImageSpec } from "@/types/deck";
import type { Theme, Rect } from "@/types/theme";
import { resolveTheme } from "@/themes";
import {
  isColsLayout,
  getColCount,
  getColumnRects,
} from "@/engine/shared/layout";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export async function exportDeck(deck: Deck, path: string): Promise<void> {
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    await renderSlide(s, slide, theme);
  }
  const data = (await pptx.write({
    outputType: "uint8array",
  })) as Uint8Array;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_binary_file", {
    path,
    data: Array.from(data),
  });
}

export async function exportDeckToBlob(deck: Deck): Promise<Blob> {
  const pptx = new PptxGenJS();
  initPptx(pptx);
  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  for (const slide of deck.slides) {
    const s = pptx.addSlide();
    await renderSlide(s, slide, theme);
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}

function initPptx(pptx: PptxGenJS) {
  pptx.defineLayout({ name: "CUSTOM", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "CUSTOM";
}

async function renderSlide(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const layout = theme.layouts[slide.layout];
  if (!layout) return;

  s.background = { fill: theme.colors.background };

  const isCols = isColsLayout(slide.layout);

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

  // 内容页左侧装饰条
  if (
    slide.layout !== "cover" &&
    slide.layout !== "section" &&
    slide.layout !== "closing"
  ) {
    s.addShape("rect", {
      x: 0,
      y: SLIDE_H * 0.1,
      w: 0.06,
      h: SLIDE_H * 0.8,
      fill: { color: theme.colors.primary },
      line: { width: 0 },
      rectRadius: 0.02,
    });
  }

  // 标题
  if (layout.title && slide.title) {
    addText(s, slide.title, layout.title, {
      fontSize: theme.fontSize.h1,
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
        fontSize: theme.fontSize.body,
        fontFace: theme.fonts.body,
        color: theme.colors.textMuted,
      },
    );
  }

  // 正文 / bullets / items
  if (isCols && slide.items && slide.items.length > 0) {
    const colRects = getColumnRects(layout.body!, getColCount(slide.layout));
    const items = slide.items.slice(0, colRects.length);
    items.forEach((item, i) => {
      const col = colRects[i];
      const titleH = 0.08;
      if (item.title) {
        addText(
          s,
          item.title,
          { x: col.x, y: col.y, w: col.w, h: titleH * 0.7 },
          {
            fontSize: theme.fontSize.h2 - 2,
            fontFace: theme.fonts.title,
            color: theme.colors.primary,
            bold: true,
            align: "left",
          },
        );
        s.addShape("line", {
          x: col.x,
          y: col.y + titleH * 0.78,
          w: col.w,
          h: 0,
          line: { color: theme.colors.secondary, width: 1 },
        });
      }
      const bulletArea: Rect = {
        x: col.x,
        y: col.y + (item.title ? titleH : 0),
        w: col.w,
        h: col.h - (item.title ? titleH : 0),
      };
      if (item.bullets && item.bullets.length > 0) {
        const bSegments = item.bullets.map((b) => ({
          text: b,
          options: {
            fontSize: theme.fontSize.body - 1,
            fontFace: theme.fonts.body,
            color: theme.colors.text,
            bullet: { characterCode: "25CF", color: theme.colors.accent },
            lineSpacingMultiple: 1.4,
            paraSpaceAfter: 4,
          } as Record<string, unknown>,
        }));
        addTextSegments(s, bSegments as PptxGenJS.TextProps[], bulletArea, {
          valign: "top",
        });
      } else if (item.body) {
        addText(s, item.body, bulletArea, {
          fontSize: theme.fontSize.body - 1,
          fontFace: theme.fonts.body,
          color: theme.colors.text,
          valign: "top",
        });
      }
    });
  } else if (layout.body) {
    if (slide.bullets && slide.bullets.length > 0) {
      const segments = buildBulletSegments(slide.bullets, theme);
      addTextSegments(s, segments, layout.body, {
        valign: "top",
        lineSpacingMultiple: 1.5,
      });
    } else if (slide.body) {
      addText(s, slide.body, layout.body, {
        fontSize: theme.fontSize.body,
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
    // 图表标题
    if (slide.chart.title) {
      addText(
        s,
        slide.chart.title,
        {
          x: layout.visual.x,
          y: layout.visual.y - 0.08,
          w: layout.visual.w,
          h: 0.06,
        },
        {
          fontSize: theme.fontSize.h2 - 2,
          fontFace: theme.fonts.title,
          color: theme.colors.primary,
          bold: true,
          align: "left",
        },
      );
    }
    s.addChart(
      slide.chart.type as "bar" | "pie" | "line" | "doughnut",
      chartData,
      chartOpts,
    );
  }

  // 演讲者备注
  if (slide.notes) {
    s.addNotes(slide.notes);
  }

  // 图片
  if (slide.image && layout.visual) {
    await renderImage(s, slide.image, layout.visual);
  }
}

async function renderImage(s: PptxGenJS.Slide, image: ImageSpec, area: Rect) {
  const x = area.x * SLIDE_W;
  const y = area.y * SLIDE_H;
  const w = area.w * SLIDE_W;
  const h = area.h * SLIDE_H;

  if (image.type === "icon" || !image.url) {
    // 无实际图片：画一个占位矩形
    s.addShape("rect", {
      x,
      y,
      w,
      h,
      fill: { color: "F0F0F0" },
      line: { color: "CCCCCC", width: 0.5 },
      rectRadius: 0.05,
    });
    s.addText(image.alt || "图片", {
      x,
      y,
      w,
      h,
      fontSize: 12,
      color: "999999",
      align: "center",
      valign: "middle",
      fontFace: "sans-serif",
    });
    return;
  }

  try {
    // 尝试从 URL 获取图片数据嵌入 pptx
    const resp = await fetch(image.url);
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    s.addImage({
      data: `image/${blob.type.split("/").pop() || "png"};base64,${base64}`,
      x,
      y,
      w,
      h,
    });
  } catch {
    // 图片获取失败时以占位代替
    s.addShape("rect", {
      x,
      y,
      w,
      h,
      fill: { color: "F0F0F0" },
      line: { color: "CCCCCC", width: 0.5 },
      rectRadius: 0.05,
    });
    s.addText(image.alt || "图片加载失败", {
      x,
      y,
      w,
      h,
      fontSize: 12,
      color: "999999",
      align: "center",
      valign: "middle",
    });
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

function buildBulletSegments(
  nodes: BulletNode[],
  theme: Theme,
): PptxGenJS.TextProps[] {
  const segments: PptxGenJS.TextProps[] = [];
  const bulletCodes = ["25CF", "25CB", "25A0"];
  const walk = (items: BulletNode[], level: number) => {
    for (const item of items) {
      const fontSize =
        level === 0
          ? theme.fontSize.body
          : level === 1
            ? theme.fontSize.body - 2
            : theme.fontSize.caption;
      segments.push({
        text: item.text,
        options: {
          fontSize,
          fontFace: theme.fonts.body,
          color: level === 0 ? theme.colors.text : theme.colors.textMuted,
          indentLevel: level,
          bullet: { characterCode: bulletCodes[level] ?? "25CF" },
          lineSpacingMultiple: 1.5,
          paraSpaceAfter: 4,
        },
      });
      if (item.children) walk(item.children, level + 1);
    }
  };
  walk(nodes, 0);
  return segments;
}

function addTextSegments(
  s: PptxGenJS.Slide,
  segments: PptxGenJS.TextProps[],
  area: { x: number; y: number; w: number; h: number },
  sharedOpts: Record<string, unknown>,
) {
  s.addText(segments, {
    x: area.x * SLIDE_W,
    y: area.y * SLIDE_H,
    w: area.w * SLIDE_W,
    h: area.h * SLIDE_H,
    autoFit: true,
    ...sharedOpts,
  });
}
