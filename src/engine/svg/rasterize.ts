/**
 * SVG 栅格化（D3 视觉自检）：把页面 SVG 渲染为位图 data URL，
 * 供视觉模型审查。浏览器/Tauri webview 均走 Image + Canvas。
 */

/** 把 SVG 字符串栅格化为 JPEG data URL（默认宽 720px，2x 抗模糊） */
export async function rasterizeSvg(svg: string, width = 720): Promise<string> {
  const viewBox = svg.match(
    /viewBox\s*=\s*["']0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/i,
  );
  const vw = viewBox ? Number.parseFloat(viewBox[1]) : 1280;
  const vh = viewBox ? Number.parseFloat(viewBox[2]) : 720;
  const scale = width / vw;
  const w = Math.round(width);
  const h = Math.round(vh * scale);

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG 渲染失败"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
