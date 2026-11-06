import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useDeckStore } from "@/store/deck";
import { useToastStore } from "@/store/toast";
import { importUrl } from "@/services/importer";
import type { Deck } from "@/types/deck";
import { ImportDialog } from "./import-dialog";

const generatedSlides = [
  { id: "g1", layout: "cover" as const, title: "导入封面" },
  { id: "g2", layout: "content" as const, title: "导入内容" },
  { id: "g3", layout: "closing" as const, title: "导入结尾" },
];

vi.mock("@/store/job", () => ({
  runJob: vi.fn(async (_opts: unknown, task: (job: unknown) => unknown) =>
    task({
      id: "job-1",
      update: vi.fn(),
      signal: new AbortController().signal,
    }),
  ),
  useJobStore: { getState: () => ({ cancelJob: vi.fn() }) },
}));

vi.mock("@/services/importer", () => ({
  importDocx: vi.fn(),
  importMarkdown: vi.fn(async () => ({
    title: "导入测试文档",
    text: "正文内容",
    structured: { sections: [{ heading: "第一章", content: "内容" }] },
  })),
  importPdf: vi.fn(),
  importUrl: vi.fn(),
  parseDocument: vi.fn(() => ({
    id: "doc-1",
    rawText: "正文内容",
    warnings: [],
    source: { title: "导入测试文档", type: "markdown", ref: "a.md" },
    sections: [{ id: "sec-1", heading: "第一章", content: "内容" }],
  })),
  getDocumentStrategy: vi.fn(() => "direct"),
  generateOutlineFromDocument: vi.fn(async () => generatedSlides),
  prepareDocumentForOutline: vi.fn(async () => ({})),
}));

function makeDeck(): Deck {
  return {
    id: "d1",
    version: 2,
    title: "现有项目",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides: [
      { id: "s1", layout: "cover", title: "原有封面" },
      { id: "s2", layout: "content", title: "原有内容" },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

beforeEach(() => {
  useDeckStore.setState({
    deck: makeDeck(),
    past: [],
    future: [],
    dirty: false,
    persist: async () => {},
  });
  useToastStore.setState({ toasts: [] });
});

async function triggerImport(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).toBeTruthy();
  fireEvent.change(input!, {
    target: {
      files: [new File(["# 文档"], "a.md", { type: "text/markdown" })],
    },
  });
  await waitFor(() => expect(screen.getByText("选择结果落点")).toBeTruthy());
}

describe("ImportDialog 输入与错误处理", () => {
  it("取消按钮关闭弹窗", () => {
    const onClose = vi.fn();
    render(<ImportDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("不支持的扩展名给出失败提示", async () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog open onClose={onClose} />);
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "a.txt", { type: "text/plain" })] },
    });
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((t) => t.title === "不支持的文件格式"),
      ).toBe(true),
    );
  });

  it("网页链接导入失败时提示错误并保持可重试", async () => {
    vi.mocked(importUrl).mockRejectedValueOnce(new Error("无法访问该网页"));
    const onClose = vi.fn();
    render(<ImportDialog open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /网页链接/ }));
    fireEvent.change(
      screen.getByPlaceholderText("https://example.com/article"),
      { target: { value: "https://example.com/a" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "解析并导入" }));

    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.message === "无法访问该网页"),
      ).toBe(true),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ImportDialog 结果落点", () => {
  it("已有页面时停在选择页并提供替换/追加", async () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog open onClose={onClose} />);
    await triggerImport(container);

    expect(screen.getByText("追加到末尾")).toBeTruthy();
    expect(screen.getByText("替换现有页面")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("追加到末尾保留现有页面", async () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog open onClose={onClose} />);
    await triggerImport(container);

    fireEvent.click(screen.getByText("追加到末尾"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const slides = useDeckStore.getState().deck!.slides;
    expect(slides.map((s) => s.id)).toEqual(["s1", "s2", "g1", "g2", "g3"]);
  });

  it("替换需经过 ConfirmDialog 确认", async () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog open onClose={onClose} />);
    await triggerImport(container);

    fireEvent.click(screen.getByText("替换现有页面"));
    // 确认框文案说明会被替换的现有页数
    expect(
      screen.getByText("当前 2 页将被导入结果替换，此操作不可撤销。"),
    ).toBeTruthy();

    const confirmButtons = screen.getAllByRole("button", {
      name: "替换现有页面",
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useDeckStore.getState().deck!.slides.map((s) => s.id)).toEqual([
      "g1",
      "g2",
      "g3",
    ]);
  });
});
