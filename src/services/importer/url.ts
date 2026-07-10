import type { ImportResult } from "./types";
import { httpRequest } from "@/services/http-client";

export async function importUrl(url: string): Promise<ImportResult> {
  // URL 安全校验
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`不支持的协议: ${parsedUrl.protocol}`);
  }
  // 阻止内网地址（SSRF 防护）
  const hostname = parsedUrl.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") ||
    hostname.startsWith("192.168.") ||
    hostname.endsWith(".local") ||
    hostname === "[::1]"
  ) {
    throw new Error("不支持内网地址");
  }

  const resp = await httpRequest(url);
  if (!resp.ok) {
    throw new Error(`获取 URL 失败 (${resp.status})`);
  }
  const html = await resp.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 使用 @mozilla/readability 提取正文
  const { Readability } = await import("@mozilla/readability");
  const reader = new Readability(doc.cloneNode(true) as Document);
  const article = reader.parse();

  const title =
    article?.title ?? doc.querySelector("title")?.textContent?.trim() ?? url;

  let text: string;
  let sections: { heading: string; content: string }[];

  if (article?.textContent) {
    text = article.textContent.replace(/\s+/g, " ").trim();

    // 按自然段落分节
    const contentHtml = article.content ?? "";
    const contentDoc = parser.parseFromString(contentHtml, "text/html");
    const headings = contentDoc.querySelectorAll("h1, h2, h3");
    sections = [];
    let currentHeading = "概述";
    let currentContent: string[] = [];

    if (headings.length > 0) {
      for (const el of contentDoc.body?.childNodes ?? []) {
        const elTag = (el as Element).tagName?.toLowerCase();
        if (["h1", "h2", "h3"].includes(elTag)) {
          if (currentContent.length > 0) {
            sections.push({
              heading: currentHeading,
              content: currentContent.join("\n"),
            });
          }
          currentHeading =
            (el as Element).textContent?.trim() ?? currentHeading;
          currentContent = [];
        } else {
          const t = (el as Element).textContent?.trim();
          if (t && t.length > 15) currentContent.push(t);
        }
      }
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
      }
    } else {
      sections = [{ heading: "正文", content: text.slice(0, 5000) }];
    }
  } else {
    // Readability 解析失败时降级
    const scripts = doc.querySelectorAll("script, style, nav, footer, header");
    for (const el of scripts) el.remove();

    text = doc.body?.textContent ?? "";
    text = text.replace(/\s+/g, " ").trim();

    const paragraphs: string[] = [];
    for (const p of doc.querySelectorAll("p, h1, h2, h3, li")) {
      const t = (p.textContent ?? "").trim();
      if (t.length > 15) paragraphs.push(t);
    }

    sections = [
      { heading: "概述", content: paragraphs.slice(0, 5).join("\n") },
    ];
    if (paragraphs.length > 5) {
      sections.push({
        heading: "详细内容",
        content: paragraphs.slice(5).join("\n"),
      });
    }
  }

  return { title, text, structured: { title, sections } };
}
