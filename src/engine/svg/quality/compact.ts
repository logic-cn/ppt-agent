/**
 * SVG 输出 token 压缩（参照 PPT Master compact_svg_coordinates / compact_svg_styles）：
 * 坐标类属性与 path/polygon/transform 里的小数一律取整、去除注释、折叠标签间空白。
 * 1280×720 画布上亚像素小数毫无渲染意义，去掉它能显著缩短字符串——
 * 既降低端侧模型「下一轮把整页 SVG 再读回来」时的输入 token（定向修改/一致性纠正），
 * 也让存储、预览与导出用的底稿更干净。
 *
 * 安全性：只做「等价或亚像素级」的数值改写，绝不增删元素或改结构，
 * 因此不会引入新的越界/重叠；几何校验在此之前已对模型原始输出跑完。
 * 引号属性只处理双/单引号成对出现的常规写法，跳过 viewBox（须保持精确整数串）。
 */

const NUM_ATTRS = new Set([
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "x2",
  "y1",
  "y2",
  "dx",
  "dy",
]);

function roundDecimals(body: string): string {
  return body.replace(/-?\d+\.\d+/g, (s) => String(Math.round(Number(s))));
}

export function compactSvgOutput(svg: string): string {
  let out = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim();

  // 坐标/尺寸类属性值取整（前一个空白保证属性边界，避开 data-chart-x 之类）
  out = out.replace(
    /(\s)([a-zA-Z][\w:-]*)\s*=\s*(["'])(-?\d+\.\d+)\3/g,
    (m, sp: string, name: string, q: string, val: string) => {
      if (!NUM_ATTRS.has(name.toLowerCase())) return m;
      return `${sp}${name}=${q}${String(Math.round(Number(val)))}${q}`;
    },
  );

  // path 的 d 与 polygon/polyline 的 points：内部数字取整
  out = out.replace(
    /(\s)(d|points)\s*=\s*(["'])([^"']*)\3/gi,
    (_m, sp: string, name: string, q: string, body: string) =>
      `${sp}${name}=${q}${roundDecimals(body)}${q}`,
  );

  // transform="translate(...)" / scale 等函数内的数字取整
  out = out.replace(
    /(\s)transform\s*=\s*(["'])([^"']*)\2/gi,
    (_m, sp: string, q: string, body: string) =>
      /\d+\.\d+/.test(body)
        ? `${sp}transform=${q}${roundDecimals(body)}${q}`
        : _m,
  );

  // 去属性串里因折叠而残留的多余内部空白（如 d="M 0 . 10" 之类保守处理）
  out = out.replace(/\s{2,}/g, " ");

  return out;
}
