/**
 * 网络图片搜索兜底（B7，参照 PPT Master image-searcher）。
 * 零配置走 Openverse（聚合 Wikimedia/Flickr 等 CC 授权库）；
 * 只返回开放授权（CC0/PD/BY/BY-SA 等）图片，并组装署名文案。
 * 结果 URL 需经 fetchImageAsDataUrl 内嵌为 data URL 后才能进入 SVG 管线
 * （契约禁止外部引用，translator 仅接受 data:）。
 */

export interface WebImage {
  /** 原图 URL */
  url: string;
  /** 缩略图 URL（结果列表展示用） */
  thumb: string;
  width?: number;
  height?: number;
  /** 来源站点（Openverse source / Wikimedia） */
  source: string;
  /** 许可证简称，如 CC0 / BY-SA 4.0 */
  license: string;
  /** 建议展示的署名文案 */
  attribution: string;
}

interface OpenverseResult {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  license?: string;
  license_version?: string;
  width?: number;
  height?: number;
  source?: string;
  creator?: string;
}

const OPENVERSE_ENDPOINT = "https://api.openverse.org/v1/images/";

/** Openverse 许可证简称 → 展示名 */
function licenseLabel(license?: string, version?: string): string {
  const l = (license ?? "").toUpperCase();
  if (!l) return "unknown";
  if (l === "CC0" || l === "PDM") return l === "CC0" ? "CC0" : "Public Domain";
  return version ? `${l} ${version}` : l;
}

function openverseAttribution(r: OpenverseResult): string {
  const creator = r.creator?.trim() || r.source || "unknown";
  return `${creator} / ${r.source ?? "Openverse"} · ${licenseLabel(r.license, r.license_version)}`;
}

/** 图片是否允许商用/展示场景使用（排除 ND 与未声明许可） */
function isUsableLicense(license?: string): boolean {
  const l = (license ?? "").toLowerCase();
  if (!l) return false;
  return !l.includes("nd");
}

/** Openverse 搜索（零配置；匿名访问有限流，失败时抛出可读错误） */
export async function searchOpenverse(
  query: string,
  signal?: AbortSignal,
): Promise<WebImage[]> {
  const url = new URL(OPENVERSE_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "12");
  url.searchParams.set("license_type", "all-cc");
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    throw new Error(
      `图片搜索失败（Openverse ${res.status}）${res.status === 429 ? "：匿名限流，请稍后重试" : ""}`,
    );
  }
  const data = (await res.json()) as { results?: OpenverseResult[] };
  return (data.results ?? [])
    .filter((r) => r.url && isUsableLicense(r.license))
    .map((r) => ({
      url: r.url!,
      thumb: r.thumbnail ?? r.url!,
      width: r.width,
      height: r.height,
      source: r.source ?? "openverse",
      license: licenseLabel(r.license, r.license_version),
      attribution: openverseAttribution(r),
    }));
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** 下载图片并转为 data URL（SVG 契约仅接受 data: 内嵌；需目标站允许 CORS） */
export async function fetchImageAsDataUrl(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`图片下载失败（${res.status}）`);
  }
  const blob = await res.blob();
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("图片超过 8MB，请换一张");
  }
  return blobToDataUrl(blob);
}

/** 用 arrayBuffer 而非 FileReader，避免不同运行时的 Blob 实现不互认 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const type = blob.type || "application/octet-stream";
  return `data:${type};base64,${btoa(binary)}`;
}

// ---- Pexels（可选源，需 API Key；商业摄影质量更稳）----

interface PexelsPhoto {
  src?: { large?: string; medium?: string };
  alt?: string;
  photographer?: string;
  width?: number;
  height?: number;
}

async function searchPexels(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<WebImage[]> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "12");
  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
    signal,
  });
  if (!res.ok) {
    throw new Error(`图片搜索失败（Pexels ${res.status}）`);
  }
  const data = (await res.json()) as { photos?: PexelsPhoto[] };
  return (data.photos ?? [])
    .filter((p) => p.src?.large)
    .map((p) => ({
      url: p.src!.large!,
      thumb: p.src?.medium ?? p.src!.large!,
      width: p.width,
      height: p.height,
      source: "pexels",
      license: "Pexels License",
      attribution: `Photo by ${p.photographer ?? "unknown"} on Pexels`,
    }));
}

/**
 * 聚合搜索（C4）：配置 Pexels Key 时 Pexels 结果优先（现代商业摄影质量更稳），
 * 其后并入 Openverse 零配置源（CC 授权库），按 URL 去重。
 */
export async function searchWebImages(
  query: string,
  opts: { pexelsApiKey?: string; signal?: AbortSignal } = {},
): Promise<WebImage[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const results: WebImage[] = [];
  if (opts.pexelsApiKey?.trim()) {
    try {
      results.push(
        ...(await searchPexels(trimmed, opts.pexelsApiKey.trim(), opts.signal)),
      );
    } catch (e) {
      // 可选源失败不阻断：继续用 Openverse 兜底
      console.warn("Pexels 搜索失败，回退 Openverse", e);
    }
  }
  const openverse = await searchOpenverse(trimmed, opts.signal);
  const seen = new Set(results.map((r) => r.url));
  for (const r of openverse) {
    if (!seen.has(r.url)) results.push(r);
  }
  return results;
}
