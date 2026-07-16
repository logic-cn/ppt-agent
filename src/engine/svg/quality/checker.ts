import type { SpecLock } from "@/design/spec-lock";
import { validateSvgContract } from "../spec-contract";

export type SvgIssue = {
  severity: "error" | "warn";
  message: string;
  location?: string;
};

const GEOMETRIC_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "image",
  "text",
]);

function num(attr: string | undefined): number | undefined {
  if (attr === undefined) return undefined;
  const v = Number(attr);
  return Number.isFinite(v) ? v : undefined;
}

function attr(part: string, name: string): string | undefined {
  const m = part.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : undefined;
}

function tagContent(svg: string, openTag: string): string {
  const tagName = openTag.replace(/[<>\s/]/g, "").split(/\s/)[0];
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const m = svg.match(re);
  return m ? m[1].replace(/<[^>]+>/g, "") : "";
}

export function checkSvg(svg: string, specLock: SpecLock): SvgIssue[] {
  const issues: SvgIssue[] = [];
  const canvasW = specLock.canvas.w;
  const canvasH = specLock.canvas.h;

  const contractErrors = validateSvgContract(svg);
  for (const e of contractErrors) {
    issues.push({ severity: "error", message: e });
  }

  const tagRegex = /<([a-zA-Z][\w:-]*)(?:\s[^>]*?)?\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(svg)) !== null) {
    const full = match[0];
    const name = match[1].toLowerCase();
    if (!GEOMETRIC_TAGS.has(name)) continue;

    const loc = `${name}@${match.index}`;

    if (name === "rect") {
      const x = num(attr(full, "x")) ?? 0;
      const y = num(attr(full, "y")) ?? 0;
      const w = num(attr(full, "width")) ?? 0;
      const h = num(attr(full, "height")) ?? 0;
      checkBounds(x, y, w, h, canvasW, canvasH, loc, issues);
    } else if (name === "image") {
      const x = num(attr(full, "x")) ?? 0;
      const y = num(attr(full, "y")) ?? 0;
      const w = num(attr(full, "width")) ?? 0;
      const h = num(attr(full, "height")) ?? 0;
      checkBounds(x, y, w, h, canvasW, canvasH, loc, issues);
    } else if (name === "circle") {
      const cx = num(attr(full, "cx")) ?? 0;
      const cy = num(attr(full, "cy")) ?? 0;
      const r = num(attr(full, "r")) ?? 0;
      checkBounds(cx - r, cy - r, r * 2, r * 2, canvasW, canvasH, loc, issues);
    } else if (name === "ellipse") {
      const cx = num(attr(full, "cx")) ?? 0;
      const cy = num(attr(full, "cy")) ?? 0;
      const rx = num(attr(full, "rx")) ?? 0;
      const ry = num(attr(full, "ry")) ?? 0;
      checkBounds(
        cx - rx,
        cy - ry,
        rx * 2,
        ry * 2,
        canvasW,
        canvasH,
        loc,
        issues,
      );
    } else if (name === "line") {
      const x1 = num(attr(full, "x1")) ?? 0;
      const y1 = num(attr(full, "y1")) ?? 0;
      const x2 = num(attr(full, "x2")) ?? 0;
      const y2 = num(attr(full, "y2")) ?? 0;
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      checkBounds(minX, minY, w, h, canvasW, canvasH, loc, issues);
    } else if (name === "text") {
      const x = num(attr(full, "x")) ?? 0;
      const y = num(attr(full, "y")) ?? 0;
      const fontSize = num(attr(full, "font-size")) ?? 16;
      const content = tagContent(svg, full);
      const estWidth = content.length * fontSize * 0.6;
      if (x < 0 || y < 0 || x + estWidth > canvasW) {
        issues.push({
          severity: "error",
          message: `text 越界：x=${x}, y=${y}, 估算宽度=${estWidth.toFixed(0)} 超出画布宽度 ${canvasW}`,
          location: loc,
        });
      }
      if (estWidth > canvasW) {
        issues.push({
          severity: "warn",
          message: `text 字号预算溢出：估算宽度 ${estWidth.toFixed(0)} 超过画布宽度 ${canvasW}`,
          location: loc,
        });
      }
    }
  }

  return issues;
}

function checkBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number,
  loc: string,
  issues: SvgIssue[],
): void {
  if (x < 0) {
    issues.push({
      severity: "error",
      message: `元素越界：左边界 x=${x} < 0`,
      location: loc,
    });
  }
  if (y < 0) {
    issues.push({
      severity: "error",
      message: `元素越界：上边界 y=${y} < 0`,
      location: loc,
    });
  }
  if (x + w > canvasW) {
    issues.push({
      severity: "error",
      message: `元素超出右边界：x+width=${x + w} > ${canvasW}`,
      location: loc,
    });
  }
  if (y + h > canvasH) {
    issues.push({
      severity: "error",
      message: `元素超出下边界：y+height=${y + h} > ${canvasH}`,
      location: loc,
    });
  }
}
