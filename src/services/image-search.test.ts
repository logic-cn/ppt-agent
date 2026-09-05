// 网络图片搜索与确定性嵌入测试（B7）
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchOpenverse, fetchImageAsDataUrl } from "./image-search";
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
