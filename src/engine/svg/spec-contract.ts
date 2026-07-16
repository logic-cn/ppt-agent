const ALLOWED = new Set([
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "path",
  "text",
  "tspan",
  "line",
  "polygon",
  "polyline",
  "image",
  "linearGradient",
  "radialGradient",
  "stop",
]);

const FORBIDDEN = new Set(["script", "foreignObject", "use", "a"]);

export const SVG_CONTRACT = {
  width: 1280,
  height: 720,
  allowedElements: ALLOWED,
  forbiddenElements: FORBIDDEN,
};

const REQUIRED_VIEWBOX = "0 0 1280 720";

export function validateSvgContract(svg: string): string[] {
  const errors: string[] = [];

  const rootMatch = svg.match(/<svg[^>]*>/i);
  if (!rootMatch) {
    errors.push("缺少 <svg> 根元素");
    return errors;
  }

  const rootTag = rootMatch[0];
  const vb = rootTag.match(/viewBox=["']([^"']+)["']/i);
  if (!vb) {
    errors.push("svg 缺少 viewBox");
    return errors;
  }
  const normalized = vb[1].trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (normalized !== REQUIRED_VIEWBOX) {
    errors.push(`viewBox 必须为 "0 0 1280 720"，实际 "${vb[1].trim()}"`);
  }

  const tags = svg.match(/<([a-zA-Z][\w:-]*)(?:\s[^>]*?)?\/?>/g) ?? [];
  for (const t of tags) {
    const nameMatch = t.match(/^<\s*([a-zA-Z][\w:-]*)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (name === "svg") continue;

    if (FORBIDDEN.has(name)) {
      errors.push(`禁止的 SVG 元素 <${name}>`);
      continue;
    }
    if (!ALLOWED.has(name)) {
      errors.push(`不支持的 SVG 元素 <${name}>`);
    }
  }

  const hrefRegex = /(href|xlink:href)\s*=\s*["']([^"']+)["']/gi;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefRegex.exec(svg)) !== null) {
    const url = hrefMatch[2];
    if (url.startsWith("data:")) continue;
    if (url.startsWith("#")) continue;
    errors.push(`禁止外部引用资源: ${hrefMatch[1]}="${url}"`);
  }

  return errors;
}
