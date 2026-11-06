import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useQualityStore } from "@/store/quality";
vi.mock("@/engine/preview", () => ({
  SlideThumbnail: () => <div />,
}));
import { useDeckStore } from "@/store/deck";
import type { Deck } from "@/types/deck";
import { OutlineEditor } from "./outline-editor";

function makeDeck(): Deck {
  return {
    id: "d1",
    version: 2,
    title: "排序测试",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides: [
      { id: "s1", layout: "cover", title: "第一页" },
      { id: "s2", layout: "content", title: "第二页" },
      { id: "s3", layout: "closing", title: "第三页" },
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
  useQualityStore.setState({ report: null });
});

describe("OutlineEditor 页序调整", () => {
  it("点击上移后选中索引跟随被移动页面", () => {
    const onSelectSlide = vi.fn();
    render(<OutlineEditor selectedIndex={2} onSelectSlide={onSelectSlide} />);

    // 第三个页面的「上移」按钮
    fireEvent.click(screen.getAllByTitle("上移")[2]);

    const slides = useDeckStore.getState().deck!.slides;
    expect(slides.map((s) => s.id)).toEqual(["s1", "s3", "s2"]);
    expect(onSelectSlide).toHaveBeenCalledWith(1);
  });

  it("点击下移后选中索引跟随被移动页面", () => {
    const onSelectSlide = vi.fn();
    render(<OutlineEditor selectedIndex={0} onSelectSlide={onSelectSlide} />);

    fireEvent.click(screen.getAllByTitle("下移")[0]);

    const slides = useDeckStore.getState().deck!.slides;
    expect(slides.map((s) => s.id)).toEqual(["s2", "s1", "s3"]);
    expect(onSelectSlide).toHaveBeenCalledWith(1);
  });

  it("可编辑标题与版式，删除页面需两步确认", () => {
    render(<OutlineEditor selectedIndex={0} onSelectSlide={vi.fn()} />);

    fireEvent.change(screen.getAllByPlaceholderText("页面标题")[1], {
      target: { value: "新标题" },
    });
    expect(useDeckStore.getState().deck!.slides[1].title).toBe("新标题");

    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "image" },
    });
    expect(useDeckStore.getState().deck!.slides[1].layout).toBe("image");

    fireEvent.click(screen.getAllByTitle("删除")[2]);
    expect(screen.getByText("删除这一页？")).toBeTruthy();
    fireEvent.click(screen.getByText("取消"));
    expect(screen.queryByText("删除这一页？")).toBeNull();

    fireEvent.click(screen.getAllByTitle("删除")[2]);
    fireEvent.click(screen.getByText("确认"));
    expect(useDeckStore.getState().deck!.slides).toHaveLength(2);
  });

  it("空大纲展示引导，添加页面后进入编辑", async () => {
    useDeckStore.setState({ deck: { ...makeDeck(), slides: [] } });
    render(<OutlineEditor selectedIndex={0} onSelectSlide={vi.fn()} />);

    expect(
      screen.getByText("在右侧 AI 助手聊天框中输入主题生成大纲"),
    ).toBeTruthy();
    fireEvent.click(screen.getByTitle("添加页面"));

    await waitFor(() =>
      expect(useDeckStore.getState().deck!.slides).toHaveLength(1),
    );
    expect(useDeckStore.getState().deck!.slides[0].layout).toBe("content");
  });

  it("添加页面沿用末页版式", async () => {
    render(<OutlineEditor selectedIndex={0} onSelectSlide={vi.fn()} />);
    fireEvent.click(screen.getByTitle("添加页面"));

    await waitFor(() =>
      expect(useDeckStore.getState().deck!.slides).toHaveLength(4),
    );
    expect(useDeckStore.getState().deck!.slides[3].layout).toBe("closing");
  });

  it("质量标记取每页最严重级别", () => {
    useQualityStore.setState({
      report: [
        {
          rule: "soft-first",
          severity: "soft",
          message: "提示",
          autoFixable: false,
          slideId: "s1",
        },
        {
          rule: "hard-later",
          severity: "hard",
          message: "严重",
          autoFixable: false,
          slideId: "s1",
        },
        {
          rule: "hard-first",
          severity: "hard",
          message: "严重",
          autoFixable: false,
          slideId: "s2",
        },
        {
          rule: "soft-later",
          severity: "soft",
          message: "提示",
          autoFixable: false,
          slideId: "s2",
        },
        {
          rule: "deck-level",
          severity: "soft",
          message: "整本问题",
          autoFixable: false,
        },
      ],
    });
    render(<OutlineEditor selectedIndex={0} onSelectSlide={vi.fn()} />);

    expect(screen.getAllByTitle("存在严重质量问题")).toHaveLength(2);
    expect(screen.queryByTitle("存在提示")).toBeNull();
  });
});
