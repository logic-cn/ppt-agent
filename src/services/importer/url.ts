import type { ImportResult } from "./types";
import { httpRequest, isTauriEnv } from "@/services/http-client";
import { t } from "@/services/i18n";

/** 单次抓取超时与正文长度上限 */
const FETCH_TIMEOUT_MS = 30_000;
const MAX_IMPORT_CHARS = 2_000_000;
/** 重定向逐跳校验的最大跳数 */
const MAX_REDIRECT_HOPS = 5;

/** 判断 IPv4（点分十进制）是否属内网/保留段 */
function isPrivateIPv4(parts: number[]): boolean {
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * 解析可能非常规编码的 IPv4 主机名（十六进制 0x7f.0.0.1、八进制 0177.0.0.1、
 * 无点十进制 2130706433），归一化为四段后判私网。
 */
function isPrivateIpv4Host(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (/^[\d.]+$/.test(h)) {
    // 纯数字点分：直接按段解析
    const parts = h.split(".").map((seg) => {
      if (seg.startsWith("0x")) return parseInt(seg, 16);
      if (seg.length > 1 && seg.startsWith("0")) return parseInt(seg, 8);
      return parseInt(seg, 10);
    });
    if (parts.length === 4) return isPrivateIPv4(parts);
    if (parts.length === 1 && Number.isFinite(parts[0])) {
      // 无点十进制 → 四段
      const n = parts[0];
      return isPrivateIPv4([
        (n >>> 24) & 255,
        (n >>> 16) & 255,
        (n >>> 8) & 255,
        n & 255,
      ]);
    }
    return true; // 无法识别的数字主机名一律视为不安全
  }
  const hex = h.match(/^0x([0-9a-f]+)$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return isPrivateIPv4([
      (n >>> 24) & 255,
      (n >>> 16) & 255,
      (n >>> 8) & 255,
      n & 255,
    ]);
  }
  return false;
}

/** 判断 IPv6 主机名（含 IPv4-mapped 形式）是否属内网/保留段 */
function isPrivateIpv6Host(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // IPv4-mapped 两种形态：::ffff:127.0.0.1 与 URL 归一化后的 ::ffff:7f00:1
  const mappedDotted = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return isPrivateIpv4Host(mappedDotted[1]);
  const mappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const n =
      ((parseInt(mappedHex[1], 16) << 16) | parseInt(mappedHex[2], 16)) >>> 0;
    return isPrivateIPv4([
      (n >>> 24) & 255,
      (n >>> 16) & 255,
      (n >>> 8) & 255,
      n & 255,
    ]);
  }
  if (h === "::" || h === "::1") return true;
  if (/^f[de]/.test(h)) return true; // fc00::/7 ULA、fe80::/10 link-local
  return false;
}

/**
 * URL 安全校验（SSRF 防护）：仅允许公网 http(s) 地址。
 * 覆盖 loopback 全段、私网全段、链路本地、CGNAT、ULA、
 * IPv4-mapped IPv6、非规范编码（十六进制/八进制/无点十进制）。
 * 重定向场景必须对每一跳的 Location 重新调用本函数。
 */
export function assertPublicHttpUrl(url: string): URL {
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(
      t("import.warnUnsupportedProtocol", { protocol: parsedUrl.protocol }),
    );
  }
  const hostname = parsedUrl.hostname.toLowerCase();
  const blocked =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isPrivateIpv4Host(hostname) ||
    isPrivateIpv6Host(hostname);
  if (blocked) {
    throw new Error(t("import.warnPrivateAddress"));
  }
  return parsedUrl;
}

export async function importUrl(url: string): Promise<ImportResult> {
  // 首跳校验；重定向逐跳重新校验，防止公网 URL 302 到内网绕过黑名单。
  // 浏览器 fetch 的 redirect:"manual" 返回 opaque response 读不到 Location，
  // 仅 Tauri（走 Rust proxy）启用逐跳校验；Web 模式保持默认跟随。
  assertPublicHttpUrl(url);

  let currentUrl = url;
  let resp: Response | null = null;
  if (isTauriEnv()) {
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      resp = await httpRequest(currentUrl, {
        followRedirects: false,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get("location");
        if (!location) break;
        // 相对 Location 以当前 URL 为基解析
        const next = new URL(location, currentUrl).toString();
        assertPublicHttpUrl(next);
        currentUrl = next;
        continue;
      }
      break;
    }
  } else {
    resp = await httpRequest(currentUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  }
  if (!resp) throw new Error("获取 URL 失败");

  if (!resp.ok) {
    throw new Error(t("import.warnFetchFailed", { status: resp.status }));
  }
  const html = (await resp.text()).slice(0, MAX_IMPORT_CHARS);

  // 检测源站的反爬/安全验证中转页（返回 200 但非正文）。
  // 这类页面无法用简单 HTTP 请求越过，明确报错而非把验证页当正文导入。
  const BLOCK_MARKERS = [
    "百度安全验证",
    "安全验证",
    "网络不给力，请稍后重试",
    "请输入验证码",
    "Verify you are human",
    "Just a moment",
    "Please enable JavaScript and cookies",
    "Please enable JavaScript to continue",
    "人机验证",
    "访问验证",
    "DDoS 防护",
  ];
  const lower = html.toLowerCase();
  if (BLOCK_MARKERS.some((m) => lower.includes(m.toLowerCase()))) {
    throw new Error(t("import.warnAntiCrawl"));
  }

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
