import type { ImportResult } from "./types";

export async function importUrl(url: string): Promise<ImportResult> {
  const html = await fetch(url).then((r) => r.text());

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 读取标题
  const title =
    doc.querySelector("title")?.textContent?.trim() ??
    doc.querySelector("h1")?.textContent?.trim() ??
    url;

  // 提取正文：去掉 script/style 后取 body 文本
  const scripts = doc.querySelectorAll("script, style, nav, footer, header");
  for (const el of scripts) el.remove();

  let text = doc.body?.textContent ?? "";
  text = text.replace(/\s+/g, " ").trim();

  // 按段落提取
  const paragraphs: string[] = [];
  for (const p of doc.querySelectorAll("p, h1, h2, h3, li")) {
    const t = (p.textContent ?? "").trim();
    if (t.length > 15) paragraphs.push(t);
  }

  const sections = [
    {
      heading: "概述",
      content: paragraphs.slice(0, 5).join("\n"),
    },
  ];
  if (paragraphs.length > 5) {
    sections.push({
      heading: "详细内容",
      content: paragraphs.slice(5).join("\n"),
    });
  }

  return {
    title,
    text,
    structured: { title, sections },
  };
}
