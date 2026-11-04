import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Slide } from "@/types/deck";
import { embedImageIntoSvg } from "@/engine/svg/embed-image";
import { useSettingsStore } from "@/store/settings";
import { useJobStore } from "@/store/job";
import * as imageSearch from "@/services/image-search";

vi.mock("@/services/image-search", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/image-search")>();
  return {
    ...actual,
    fetchImageAsDataUrl: vi.fn(async () => "data:image/png;base64,FROM_URL"),
  };
});

import { ImageTab } from "./image-tab";

const svg = `<svg viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#FFFFFF"/><text x="80" y="80">标题</text></svg>`;

function slide(patch: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    layout: "content",
    title: "页面",
    svg,
    ...patch,
  };
}

describe("ImageTab", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
    useJobStore.getState().clearFinishedJobs();
  });

  it("无配图页也提供 URL、上传和搜图入口", () => {
    render(<ImageTab slide={slide()} onUpdate={vi.fn()} />);
    expect(screen.getByText("当前页面没有配图。")).toBeTruthy();
    expect(screen.getByLabelText("图片 URL")).toBeTruthy();
    expect(screen.getByText("上传本地图片")).toBeTruthy();
    expect(screen.getAllByText("网络搜图").length).toBeGreaterThan(0);
  });

  it("应用 URL 时下载为 data URL 并同步嵌入 SVG", async () => {
    const onUpdate = vi.fn();
    render(<ImageTab slide={slide()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText("图片 URL"), {
      target: { value: "https://img.example/a.png" },
    });
    fireEvent.click(screen.getByText("应用 URL"));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.image?.url).toBe("data:image/png;base64,FROM_URL");
    expect(patch.svg).toContain('href="data:image/png;base64,FROM_URL"');
    expect(patch.svgStale).toBeUndefined();
  });

  it("上传本地图片时内嵌到 SVG", async () => {
    const onUpdate = vi.fn();
    render(<ImageTab slide={slide()} onUpdate={onUpdate} />);
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    });
    const input = screen.getByLabelText("上传本地图片") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.image?.url).toMatch(/^data:image\/png;base64,/);
    expect(patch.image?.alt).toBe("photo.png");
    expect(patch.svg).toContain("<image");
    expect(patch.svgStale).toBeUndefined();
  });

  it("删除配图时同步移除 SVG 嵌入层", async () => {
    const onUpdate = vi.fn();
    const dataUrl = "data:image/png;base64,OLD";
    const embedded = embedImageIntoSvg(svg, dataUrl);
    render(
      <ImageTab
        slide={slide({
          svg: embedded,
          image: { type: "web", url: dataUrl, alt: "旧图" },
        })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText("删除配图"));
    fireEvent.click(screen.getByText("确认"));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const patch = onUpdate.mock.calls[0][0] as Partial<Slide>;
    expect(patch.image).toBeUndefined();
    expect(patch.svg).not.toContain("<image");
    expect(patch.svg).toContain("标题");
  });

  it("搜图走 jobStore，并把 job signal 传给搜索服务", async () => {
    const searchSpy = vi.spyOn(imageSearch, "searchWebImages");
    searchSpy.mockResolvedValueOnce([
      {
        url: "https://img.example/found.png",
        thumb: "https://img.example/found_t.png",
        source: "openverse",
        license: "CC0",
        attribution: "© someone",
      },
    ]);
    render(<ImageTab slide={slide()} onUpdate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("搜索关键词，如：城市天际线"), {
      target: { value: "天际线" },
    });
    fireEvent.click(screen.getByRole("button", { name: "网络搜图" }));
    await waitFor(() => expect(searchSpy).toHaveBeenCalled());
    const opts = searchSpy.mock.calls[0][1];
    expect(opts?.signal).toBeInstanceOf(AbortSignal);
    // job 完成后应从活动任务中移除
    await waitFor(() =>
      expect(useJobStore.getState().activeJobIds).toHaveLength(0),
    );
    expect(useJobStore.getState().jobs[0]?.type).toBe("image.generate");
    searchSpy.mockRestore();
  });

  it("SVG 页面隐藏仅对历史页生效的位置选择", () => {
    render(
      <ImageTab
        slide={slide({
          image: { type: "url", url: "data:image/png;base64,A", alt: "图" },
        })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByText("位置")).toBeNull();
    expect(screen.getByText(/整页底图/)).toBeTruthy();
  });

  it("无 SVG 的历史页保留位置选择", () => {
    render(
      <ImageTab
        slide={slide({
          svg: undefined,
          image: { type: "url", url: "https://img.example/a.png", alt: "图" },
        })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("位置")).toBeTruthy();
  });
});
