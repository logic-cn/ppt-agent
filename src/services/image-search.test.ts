// 网络图片搜索与确定性嵌入测试（B7）
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  searchOpenverse,
  searchWebImages,
  fetchImageAsDataUrl,
} from "./image-search";
import {
  embedImageIntoSvg,
  validateEmbeddedSvg,
} from "@/engine/svg/embed-image";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

const spec = buildSpecLock(DEFAULT_DESIGN);

// ---- searchOpenverse ----

describe("searchOpenverse", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("解析 Openverse 结果并组装署名", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  id: "a",
                  title: "bridge",
                  url: "https://img.example/bridge.jpg",
                  thumbnail: "https://img.example/bridge_thumb.jpg",
                  license: "by",
                  license_version: "4.0",
                  source: "flickr",
                  creator: "Ann",
                  width: 1920,
                  height: 1080,
                },
                {
                  id: "b",
                  url: "https://img.example/nd.jpg",
                  license: "by-nd",
                  source: "flickr",
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const results = await searchOpenverse("bridge");
    // ND 许可被过滤
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      url: "https://img.example/bridge.jpg",
      thumb: "https://img.example/bridge_thumb.jpg",
      license: "BY 4.0",
      attribution: "Ann / flickr · BY 4.0",
    });
  });

  it("HTTP 失败抛出可读错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );
    await expect(searchOpenverse("cat")).rejects.toThrow("429");
  });
});

// ---- fetchImageAsDataUrl ----

describe("fetchImageAsDataUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("下载图片并转为 data URL", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]); // PNG 魔数
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes, { status: 200 })),
    );
    const dataUrl = await fetchImageAsDataUrl("https://img.example/a.png");
    expect(dataUrl).toMatch(/^data:application\/octet-stream;base64,/);
    expect(dataUrl.length).toBeGreaterThan(20);
  });

  it("保留响应 MIME 类型", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      ),
    );
    const dataUrl = await fetchImageAsDataUrl("https://img.example/a.png");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("超限尺寸报错", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(9 * 1024 * 1024), { status: 200 }),
      ),
    );
    await expect(
      fetchImageAsDataUrl("https://img.example/big.png"),
    ).rejects.toThrow("8MB");
  });
});

// ---- embedImageIntoSvg ----

describe("embedImageIntoSvg", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-size="40" fill="#111827">标题</text></svg>';

  it("在根元素之后插入底层 image + scrim，内容保持在其上", () => {
    const out = embedImageIntoSvg(svg, "data:image/png;base64,AAA");
    const imageIdx = out.indexOf("<image");
    const scrimIdx = out.indexOf('fill-opacity="0.45"');
    const textIdx = out.indexOf("<text");
    expect(imageIdx).toBeGreaterThan(-1);
    expect(imageIdx).toBeLessThan(scrimIdx);
    expect(scrimIdx).toBeLessThan(textIdx);
    expect(out).toContain('href="data:image/png;base64,AAA"');
    expect(out).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it("嵌入产物通过质量契约校验（默认画布无越界）", () => {
    const out = embedImageIntoSvg(svg, "data:image/png;base64,AAA");
    expect(validateEmbeddedSvg(out, spec)).toHaveLength(0);
  });

  it("attribution 以小字署名上屏并随替换语义更新", () => {
    const once = embedImageIntoSvg(svg, "data:image/png;base64,AAA", {
      attribution: "Ann / flickr · BY 4.0",
    });
    expect(once).toContain("© Ann / flickr · BY 4.0");
    const twice = embedImageIntoSvg(once, "data:image/png;base64,BBB", {
      attribution: "Bob / pexels",
    });
    expect(twice).toContain("© Bob / pexels");
    expect(twice).not.toContain("Ann / flickr");
    expect((twice.match(/<image/g) ?? []).length).toBe(1);
  });

  it("幂等引用转义：URL 含 & 时安全转义", () => {
    const out = embedImageIntoSvg(svg, "data:image/png;base64,A&B");
    expect(out).toContain("A&amp;B");
  });

  it("非 SVG 输入原样返回", () => {
    expect(embedImageIntoSvg("not svg", "data:image/png;base64,A")).toBe(
      "not svg",
    );
  });

  it("重复嵌入替换旧层而非叠加", () => {
    const once = embedImageIntoSvg(svg, "data:image/png;base64,AAA");
    const twice = embedImageIntoSvg(once, "data:image/png;base64,BBB");
    expect((twice.match(/<image/g) ?? []).length).toBe(1);
    expect(twice).toContain("base64,BBB");
    expect(twice).not.toContain("base64,AAA");
  });
});

// ---- compactSvgForPrompt（C2）----
import { compactSvgForPrompt } from "@/engine/svg/executor";

describe("compactSvgForPrompt", () => {
  it("去注释、折叠标签间空白，文本内容保持不变", () => {
    const svg = `<svg viewBox="0 0 1280 720">
  <!-- 装饰注释 -->
  <rect x="0" y="0" width="100" height="50" fill="#FFFFFF"/>
  <text x="10" y="20">标题 文本</text>
</svg>`;
    const out = compactSvgForPrompt(svg);
    expect(out).not.toContain("注释");
    expect(out).toContain("><");
    // SVG 渲染默认折叠连续空白，压缩语义一致
    expect(out).toContain("标题 文本");
  });

  it("data URL 不受影响", () => {
    const svg = '<svg><image href="data:image/png;base64,AAA BBB=="/></svg>';
    expect(compactSvgForPrompt(svg)).toContain("base64,AAA BBB==");
  });
});

describe("searchWebImages 聚合（C4 Pexels 可选源）", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("配置 Key 时 Pexels 优先，Openverse 去重并入", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = String(input);
        urls.push(u);
        if (u.includes("pexels.com")) {
          expect((init?.headers as Record<string, string>).Authorization).toBe(
            "PEXELS_KEY",
          );
          return new Response(
            JSON.stringify({
              photos: [
                {
                  src: {
                    large: "https://px/1_large.jpg",
                    medium: "https://px/1_m.jpg",
                  },
                  photographer: "Bob",
                  width: 1920,
                  height: 1080,
                },
              ],
            }),
            { status: 200 },
          );
        }
        // Openverse：与 Pexels 同 URL 的结果应被去重
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "1",
                url: "https://px/1_large.jpg",
                license: "by",
                source: "flickr",
              },
              {
                id: "2",
                url: "https://ov/2.jpg",
                license: "cc0",
                source: "wikimedia",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );
    const results = await searchWebImages("sky", {
      pexelsApiKey: "PEXELS_KEY",
    });
    expect(results.map((r) => r.url)).toEqual([
      "https://px/1_large.jpg",
      "https://ov/2.jpg",
    ]);
    expect(results[0].attribution).toBe("Photo by Bob on Pexels");
  });

  it("Pexels 失败时回退 Openverse 不阻断", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("pexels.com")) {
          return new Response("denied", { status: 401 });
        }
        return new Response(
          JSON.stringify({
            results: [{ id: "2", url: "https://ov/2.jpg", license: "cc0" }],
          }),
          { status: 200 },
        );
      }),
    );
    const results = await searchWebImages("sky", { pexelsApiKey: "BAD" });
    expect(results.map((r) => r.url)).toEqual(["https://ov/2.jpg"]);
  });
});
