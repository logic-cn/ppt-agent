import type PptxGenJS from "pptxgenjs";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const SVG_W = 1280;
const SVG_H = 720;

export const CANVAS = { w: SLIDE_W, h: SLIDE_H };

function toX(x: number): number {
  return (x / SVG_W) * SLIDE_W;
}
function toY(y: number): number {
  return (y / SVG_H) * SLIDE_H;
}
function toW(w: number): number {
  return (w / SVG_W) * SLIDE_W;
}
function toH(h: number): number {
  return (h / SVG_H) * SLIDE_H;
}

function num(value: string | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function hexColor(value: string | null | undefined): string {
  if (!value) return "000000";
  return value.replace(/^#/, "").trim() || "000000";
}

function textAnchorToAlign(
  anchor: string | null | undefined,
): "left" | "center" | "right" {
  if (anchor === "middle") return "center";
  if (anchor === "end") return "right";
  return "left";
}

export function translateSvgToSlide(
  svg: string,
  pptxSlide: PptxGenJS.Slide,
): void {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return;

  const elements = root.querySelectorAll(
    "rect, circle, ellipse, line, text, tspan",
  );
  elements.forEach((el) => {
    const tag = el.nodeName.toLowerCase();
    switch (tag) {
      case "rect":
        translateRect(el, pptxSlide);
        break;
      case "circle":
      case "ellipse":
        translateEllipse(el, tag, pptxSlide);
        break;
      case "line":
        translateLine(el, pptxSlide);
        break;
      case "text":
        translateText(el, pptxSlide);
        break;
      case "tspan":
        translateTspan(el, pptxSlide);
        break;
    }
  });
}

function translateRect(el: Element, slide: PptxGenJS.Slide): void {
  const x = toX(num(el.getAttribute("x")));
  const y = toY(num(el.getAttribute("y")));
  const w = toW(num(el.getAttribute("width")));
  const h = toH(num(el.getAttribute("height")));
  const rx = el.getAttribute("rx");
  const fill = { color: hexColor(el.getAttribute("fill")) };
  if (rx != null && num(rx) > 0) {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      fill,
      rectRadius: toW(num(rx)),
      line: { width: 0 },
    });
  } else {
    slide.addShape("rect", { x, y, w, h, fill, line: { width: 0 } });
  }
}

function translateEllipse(
  el: Element,
  tag: string,
  slide: PptxGenJS.Slide,
): void {
  const fill = { color: hexColor(el.getAttribute("fill")) };
  if (tag === "circle") {
    const cx = num(el.getAttribute("cx"));
    const cy = num(el.getAttribute("cy"));
    const r = num(el.getAttribute("r"));
    slide.addShape("ellipse", {
      x: toX(cx - r),
      y: toY(cy - r),
      w: toW(r * 2),
      h: toH(r * 2),
      fill,
      line: { width: 0 },
    });
  } else {
    const cx = num(el.getAttribute("cx"));
    const cy = num(el.getAttribute("cy"));
    const rx = num(el.getAttribute("rx"));
    const ry = num(el.getAttribute("ry"));
    slide.addShape("ellipse", {
      x: toX(cx - rx),
      y: toY(cy - ry),
      w: toW(rx * 2),
      h: toH(ry * 2),
      fill,
      line: { width: 0 },
    });
  }
}

function translateLine(el: Element, slide: PptxGenJS.Slide): void {
  const x1 = num(el.getAttribute("x1"));
  const y1 = num(el.getAttribute("y1"));
  const x2 = num(el.getAttribute("x2"));
  const y2 = num(el.getAttribute("y2"));
  const color = hexColor(el.getAttribute("stroke") ?? el.getAttribute("fill"));
  const width = num(el.getAttribute("stroke-width"), 1);
  slide.addShape("line", {
    x: toX(Math.min(x1, x2)),
    y: toY(Math.min(y1, y2)),
    w: toW(Math.abs(x2 - x1)),
    h: toH(Math.abs(y2 - y1)),
    line: { color, width },
  });
}

function translateText(el: Element, slide: PptxGenJS.Slide): void {
  const text = el.textContent ?? "";
  if (!text.trim()) return;
  const x = num(el.getAttribute("x"));
  const y = num(el.getAttribute("y"));
  slide.addText(text, {
    x: toX(x),
    y: toY(y),
    fontSize: num(el.getAttribute("font-size"), 18),
    color: hexColor(el.getAttribute("fill")),
    fontFace: el.getAttribute("font-family") ?? "sans-serif",
    align: textAnchorToAlign(el.getAttribute("text-anchor")),
    valign: "top",
  });
}

function translateTspan(el: Element, slide: PptxGenJS.Slide): void {
  const text = el.textContent ?? "";
  if (!text.trim()) return;
  const x = el.getAttribute("x");
  const y = el.getAttribute("y");
  slide.addText(text, {
    x: toX(num(x)),
    y: toY(num(y)),
    fontSize: num(el.getAttribute("font-size"), 18),
    color: hexColor(el.getAttribute("fill")),
    fontFace: el.getAttribute("font-family") ?? "sans-serif",
    align: textAnchorToAlign(el.getAttribute("text-anchor")),
    valign: "top",
  });
}
