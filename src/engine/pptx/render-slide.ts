import PptxGenJS from "pptxgenjs";
import type { RenderSlide, RenderNode } from "@/engine/render-ir/types";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export function renderRenderSlide(
  pptxSlide: PptxGenJS.Slide,
  renderSlide: RenderSlide,
): void {
  pptxSlide.background = { fill: renderSlide.background };

  for (const node of renderSlide.nodes) {
    renderNode(pptxSlide, node);
  }

  if (renderSlide.notes) {
    pptxSlide.addNotes(renderSlide.notes);
  }
}

function renderNode(pptxSlide: PptxGenJS.Slide, node: RenderNode): void {
  switch (node.type) {
    case "text":
      renderTextNode(pptxSlide, node);
      break;
    case "shape":
      renderShapeNode(pptxSlide, node);
      break;
    case "image":
      renderImageNode(pptxSlide, node);
      break;
    case "chart":
      renderChartNode(pptxSlide, node);
      break;
  }
}

function rect(area: { x: number; y: number; w: number; h: number }) {
  return {
    x: area.x * SLIDE_W,
    y: area.y * SLIDE_H,
    w: area.w * SLIDE_W,
    h: area.h * SLIDE_H,
  };
}

// ---- Text ----

function renderTextNode(
  pptxSlide: PptxGenJS.Slide,
  node: Extract<RenderNode, { type: "text" }>,
): void {
  const r = rect(node.rect);
  const text = node.text;
  const style = node.style;

  const textOpts: Record<string, unknown> = {
    fontSize: style.fontSize,
    fontFace: style.fontFamily,
    color: style.color,
    bold: style.bold ?? false,
    italic: style.italic ?? false,
    align: style.align ?? "left",
    valign: "top",
    autoFit:
      node.overflow === "shrink"
        ? true
        : node.overflow === "fit"
          ? true
          : false,
    ...(node.overflow === "clip" ? { shrinkText: false, wrapText: false } : {}),
  };

  // Bullet-style text (with •) → multi-paragraph
  if (typeof text === "string" && text.includes("•")) {
    const segments: PptxGenJS.TextProps[] = text.split("\n").map((line) => {
      const trimmed = line.trim();
      const indent = line.search(/\S/);
      const isBullet = trimmed.startsWith("•");
      return {
        text: isBullet ? trimmed.replace(/^•\s*/, "") : trimmed,
        options: {
          fontSize: isBullet ? style.fontSize : style.fontSize + 2,
          fontFace: style.fontFamily,
          color: style.color,
          bold: !isBullet,
          indentLevel: Math.min(Math.floor(indent / 2), 4),
          bullet: isBullet
            ? { characterCode: "25CF", color: style.color }
            : undefined,
          lineSpacingMultiple: 1.4,
          paraSpaceAfter: 4,
        },
      };
    });
    pptxSlide.addText(segments, r);
  } else {
    pptxSlide.addText(
      typeof text === "string" ? text : text.map((run) => run.text).join(""),
      {
        ...r,
        ...textOpts,
      },
    );
  }
}

// ---- Shape ----

function renderShapeNode(
  pptxSlide: PptxGenJS.Slide,
  node: Extract<RenderNode, { type: "shape" }>,
): void {
  const r = rect(node.rect);

  if (node.shape === "line") {
    pptxSlide.addShape("line", {
      x: r.x,
      y: r.y,
      w: r.w,
      h: 0,
      line: { color: node.stroke ?? "#ccc", width: 1 },
    });
    return;
  }

  pptxSlide.addShape("rect", {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    fill: { color: node.fill ?? "#ccc" },
    rectRadius: node.radius ? node.radius * SLIDE_W : undefined,
    line: { width: 0 },
  });
}

// ---- Image ----

async function renderImageNode(
  pptxSlide: PptxGenJS.Slide,
  node: Extract<RenderNode, { type: "image" }>,
): Promise<void> {
  const r = rect(node.rect);

  if (!node.src) {
    pptxSlide.addShape("rect", {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: { color: "F0F0F0" },
      line: { color: "CCCCCC", width: 0.5 },
      rectRadius: 0.05,
    });
    pptxSlide.addText(node.alt || "图片", {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fontSize: 12,
      color: "999999",
      align: "center",
      valign: "middle",
      fontFace: "sans-serif",
    });
    return;
  }

  try {
    const resp = await fetch(node.src);
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    pptxSlide.addImage({
      data: `image/${blob.type.split("/").pop() || "png"};base64,${base64}`,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    });
  } catch {
    pptxSlide.addShape("rect", {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: { color: "F0F0F0" },
      line: { color: "CCCCCC", width: 0.5 },
      rectRadius: 0.05,
    });
    pptxSlide.addText(node.alt || "图片加载失败", {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fontSize: 12,
      color: "999999",
      align: "center",
      valign: "middle",
    });
  }
}

// ---- Chart ----

function renderChartNode(
  pptxSlide: PptxGenJS.Slide,
  node: Extract<RenderNode, { type: "chart" }>,
): void {
  const r = rect(node.rect);
  const chart = node.chart;
  const chartColors = node.style.colors ?? ["#f59e0b", "#7c3aed", "#1a56db"];

  const chartData = [
    {
      name: chart.title ?? "数据",
      labels: chart.data.map((d) => d.label),
      values: chart.data.map((d) => d.value),
    },
  ];

  const chartOpts: Record<string, unknown> = {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    showLegend: node.style.showLegend ?? true,
    showTitle: false,
    chartColors,
  };

  pptxSlide.addChart(
    chart.type as "bar" | "pie" | "line" | "doughnut",
    chartData,
    chartOpts,
  );
}

// ---- Async wrapper for image nodes ----

export async function renderRenderSlideAsync(
  pptxSlide: PptxGenJS.Slide,
  renderSlide: RenderSlide,
): Promise<void> {
  pptxSlide.background = { fill: renderSlide.background };

  for (const node of renderSlide.nodes) {
    if (node.type === "image") {
      await renderImageNode(pptxSlide, node);
    } else {
      renderNode(pptxSlide, node);
    }
  }

  if (renderSlide.notes) {
    pptxSlide.addNotes(renderSlide.notes);
  }
}
