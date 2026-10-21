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
  "defs",
]);

const FORBIDDEN = new Set(["script", "foreignObject", "use", "a"]);

export const SVG_CONTRACT = {
  width: 1280,
  height: 720,
  allowedElements: ALLOWED,
  forbiddenElements: FORBIDDEN,
};

const DEFAULT_CANVAS = { w: 1280, h: 720 };

interface SvgTag {
  name: string;
  raw: string;
  closing: boolean;
}

/**
 * 扫描 SVG 的真实标签序列。
 *
 * 与「整篇正则扫标签」相比，这里额外处理两类假阳性来源：
 * - 注释 `<!-- ... -->`：注释内容不是元素；
 * - 文本节点内的裸尖括号（`<text>请使用 <b> 强调</text>`）：`<` 是正文字符，
 *   不是标签起始。
 *
 * 文本节点内只承认 `<text>` / `<tspan>` 为真标签（SVG 规范下 text 的合法子元素），
 * 其余 `<` 一律当字符数据跳过。
 */
function scanTags(svg: string): SvgTag[] {
  const tags: SvgTag[] = [];
  let i = 0;
  let textDepth = 0;

  while (i < svg.length) {
    const lt = svg.indexOf("<", i);
    if (lt < 0) break;

    if (svg.startsWith("<!--", lt)) {
      const end = svg.indexOf("-->", lt + 4);
      i = end < 0 ? svg.length : end + 3;
      continue;
    }

    if (
      textDepth > 0 &&
      !/^<\s*\/?\s*(text|tspan)\b/i.test(svg.slice(lt, lt + 16))
    ) {
      i = lt + 1;
      continue;
    }

    const gt = svg.indexOf(">", lt);
    if (gt < 0) break;
    const raw = svg.slice(lt, gt + 1);
    const m = raw.match(/^<\s*(\/?)\s*([a-zA-Z][\w:-]*)/);
    if (m) {
      const closing = m[1] === "/";
      const name = m[2];
      if (!closing && name.toLowerCase() === "text") textDepth++;
      else if (closing && name.toLowerCase() === "text") {
        textDepth = Math.max(0, textDepth - 1);
      }
      tags.push({ name, raw, closing });
    }
    i = gt + 1;
  }

  return tags;
}

export function validateSvgContract(
  svg: string,
  expected?: { w: number; h: number },
): string[] {
  const canvas = expected ?? DEFAULT_CANVAS;
  const requiredViewBox = `0 0 ${canvas.w} ${canvas.h}`;
  const errors: string[] = [];

  const tags = scanTags(svg);

  const rootTag = tags.find(
    (t) => !t.closing && t.name.toLowerCase() === "svg",
  );
  if (!rootTag) {
    errors.push("缺少 <svg> 根元素");
    return errors;
  }

  const vb = rootTag.raw.match(/viewBox=["']([^"']+)["']/i);
  if (!vb) {
    errors.push("svg 缺少 viewBox");
    return errors;
  }
  const normalized = vb[1].trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (normalized !== requiredViewBox) {
    errors.push(`viewBox 必须为 "${requiredViewBox}"，实际 "${vb[1].trim()}"`);
  }

  for (const t of tags) {
    if (t.closing) continue;
    const name = t.name;
    if (name === "svg") continue;

    if (FORBIDDEN.has(name)) {
      errors.push(`禁止的 SVG 元素 <${name}>`);
      continue;
    }
    if (!ALLOWED.has(name)) {
      errors.push(`不支持的 SVG 元素 <${name}>`);
    }
  }

  // 外部引用检查只看真实标签的属性：正文里写 href="https://…" 只是文字
  const hrefRegex = /(href|xlink:href)\s*=\s*["']([^"']+)["']/gi;
  for (const t of tags) {
    let hrefMatch: RegExpExecArray | null;
    hrefRegex.lastIndex = 0;
    while ((hrefMatch = hrefRegex.exec(t.raw)) !== null) {
      const url = hrefMatch[2];
      if (url.startsWith("data:")) continue;
      if (url.startsWith("#")) continue;
      errors.push(`禁止外部引用资源: ${hrefMatch[1]}="${url}"`);
    }
  }

  return errors;
}
