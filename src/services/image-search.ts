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
  if (blob.size > 8 * 1024 * 1024) {
    throw new Error("图片超过 8MB，请换一张");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
  return dataUrl;
}

/** 聚合搜索：当前仅 Openverse 零配置源，保留多源扩展点 */
export async function searchWebImages(
  query: string,
  signal?: AbortSignal,
): Promise<WebImage[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return searchOpenverse(trimmed, signal);
}
