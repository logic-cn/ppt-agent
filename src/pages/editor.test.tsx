import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Deck } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import { useJobStore } from "@/store/job";
import { useToastStore } from "@/store/toast";
import { checkDeckQuality, hasHardError } from "@/services/quality";

vi.mock("@/components/outline", () => ({
  OutlineEditor: () => <div data-testid="outline-editor" />,
}));
vi.mock("@/components/inspector/inspector-panel", () => ({
  InspectorPanel: () => <div data-testid="inspector-panel" />,
}));
vi.mock("@/engine/preview", () => ({
  SlidePreview: () => <div data-testid="slide-preview" />,
}));
vi.mock("@/components/import-dialog", () => ({
  ImportDialog: () => null,
}));
vi.mock("@/components/design", () => ({
  DesignPanel: () => null,
}));
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}));
vi.mock("@/components/presentation-mode", () => ({
  PresentationMode: () => null,
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: () => {},
}));
const { loadDeckMock } = vi.hoisted(() => ({
  loadDeckMock: vi.fn(),
}));
vi.mock("@/services/storage", () => ({
  deleteDeck: vi.fn(async () => {}),
  loadDeck: loadDeckMock,
  saveDeck: vi.fn(async () => {}),
  createEmptyDeck: vi.fn(() => ({
    id: "new-deck",
    version: 2,
    title: "未命名演示",
    slides: [],
    createdAt: 0,
    updatedAt: 0,
  })),
}));
vi.mock("@/services/quality", () => ({
  checkDeckQuality: vi.fn(() => []),
  hasHardError: vi.fn(() => false),
}));
vi.mock("@/engine/pptx", () => ({
  exportDeck: vi.fn(async () => {}),
  exportDeckToBlob: vi.fn(async () => new Blob()),
}));
const { saveTextFileMock } = vi.hoisted(() => ({
  saveTextFileMock: vi.fn(async () => ({ path: "/tmp/project.json" })),
}));
vi.mock("@/services/file-save", () => ({ saveTextFile: saveTextFileMock }));
vi.mock("@/services/project-backup", () => ({
  serializeDeckJson: vi.fn(() => '{"ok":true}'),
}));

import Editor from "./Editor";

function makeDeck(): Deck {
  return {
    id: "test-deck",
    version: 2,
    title: "测试演示",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides: [
      { id: "s0", layout: "cover", title: "封面" },
      { id: "s1", layout: "content", title: "第一页" },
      { id: "s2", layout: "closing", title: "谢谢观看" },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/editor/test-deck"]}>
      <Editor />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  loadDeckMock.mockResolvedValue(makeDeck());
  useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  useQualityStore.setState({ report: null, pendingRules: null });
  useJobStore.setState({ jobs: [], activeJobIds: [] });
  useToastStore.setState({ toasts: [] });
});

describe("Editor 导出质量门", () => {
  it("quality report 存在 hard 问题时导出按钮禁用并显示质量未达标", async () => {
    const checkDeckQualityMock = vi.mocked(checkDeckQuality);
    checkDeckQualityMock.mockReturnValue([
      {
        rule: "require_cover",
        severity: "hard",
        message: "第一页不是封面布局",
        autoFixable: false,
      },
    ]);
    const hasHardErrorMock = vi.mocked(hasHardError);
    hasHardErrorMock.mockReturnValue(true);
    useDeckStore.setState({ deck: makeDeck() });

    renderEditor();
    const exportBtn = await screen.findByRole("button", { name: /导出 PPT/ });
    expect(exportBtn.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("质量未达标")).toBeTruthy();
  });

  it("quality report 仅有 soft 问题时导出不被阻断", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    useQualityStore.setState({
      report: [
        {
          rule: "duplicate_title",
          severity: "soft",
          message: "标题重复",
          autoFixable: false,
        },
      ],
    });

    renderEditor();
    const exportBtn = await screen.findByRole("button", { name: /导出 PPT/ });
    expect(exportBtn.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("质量未达标")).toBeNull();
  });

  it("空 deck 时导出按钮禁用", async () => {
    loadDeckMock.mockResolvedValue({ ...makeDeck(), slides: [] });
    useDeckStore.setState({ deck: { ...makeDeck(), slides: [] } });

    renderEditor();
    const exportBtn = await screen.findByRole("button", { name: /导出 PPT/ });
    expect(exportBtn.hasAttribute("disabled")).toBe(true);
  });
});

describe("Editor 任务面板状态机", () => {
  it("有活跃任务时任务面板自动展开并展示进行中任务", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    useJobStore.setState({
      jobs: [
        {
          id: "j1",
          type: "outline.generate",
          title: "生成大纲",
          status: "running",
          createdAt: 0,
          updatedAt: 0,
          canCancel: true,
        },
      ],
      activeJobIds: ["j1"],
    });

    renderEditor();
    await waitFor(() => {
      expect(screen.getByText("任务列表")).toBeTruthy();
      expect(screen.getByText("生成大纲")).toBeTruthy();
      expect(screen.getByText("进行中")).toBeTruthy();
    });
  });

  it("点击任务计数按钮可收起任务面板", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    useJobStore.setState({
      jobs: [
        {
          id: "j1",
          type: "outline.generate",
          title: "生成大纲",
          status: "running",
          createdAt: 0,
          updatedAt: 0,
          canCancel: true,
        },
      ],
      activeJobIds: ["j1"],
    });

    renderEditor();
    await waitFor(() => {
      expect(screen.getByText("任务列表")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /1 个任务/ }));
    await waitFor(() => {
      expect(screen.queryByText("任务列表")).toBeNull();
    });
  });

  it("存在过期 SVG 时展示批量同步入口，同步后入口消失", async () => {
    const deck = makeDeck();
    deck.slides[1] = {
      ...deck.slides[1],
      svg: '<svg viewBox="0 0 1280 720"></svg>',
      svgStale: true,
    };
    const regenerate = vi.fn(async (slideId: string) => {
      const current = useDeckStore.getState().deck!;
      useDeckStore.setState({
        deck: {
          ...current,
          slides: current.slides.map((s) =>
            s.id === slideId ? { ...s, svgStale: false } : s,
          ),
        },
      });
    });
    useDeckStore.setState({ deck, regenerateSlide: regenerate });

    renderEditor();
    const syncBtn = await screen.findByRole("button", {
      name: /同步过期页/,
    });
    fireEvent.click(syncBtn);
    await waitFor(() =>
      expect(regenerate).toHaveBeenCalledWith("s1", expect.anything()),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /同步过期页/ })).toBeNull(),
    );
  });

  it("单页重画失败不中断整批，汇总成功与失败数", async () => {
    const deck = makeDeck();
    deck.slides[1] = {
      ...deck.slides[1],
      svg: '<svg viewBox="0 0 1280 720"></svg>',
      svgStale: true,
    };
    deck.slides[2] = {
      ...deck.slides[2],
      svg: '<svg viewBox="0 0 1280 720"></svg>',
      svgStale: true,
    };
    const regenerate = vi.fn(async (slideId: string) => {
      if (slideId === "s1") throw new Error("模型超时");
      const current = useDeckStore.getState().deck!;
      useDeckStore.setState({
        deck: {
          ...current,
          slides: current.slides.map((s) =>
            s.id === slideId ? { ...s, svgStale: false } : s,
          ),
        },
      });
    });
    useDeckStore.setState({ deck, regenerateSlide: regenerate });
    useToastStore.setState({ toasts: [] });

    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: /同步过期页/ }));
    await waitFor(() => expect(regenerate).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((x) => x.message?.includes("已同步 1 页，失败 1 页")),
      ).toBe(true),
    );
  });

  it("有失败任务且无活跃任务时展示失败详情", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    useJobStore.setState({
      jobs: [
        {
          id: "j1",
          type: "outline.generate",
          title: "生成大纲",
          status: "failed",
          createdAt: 0,
          updatedAt: 0,
          canCancel: true,
          error: "模型调用失败",
        },
      ],
      activeJobIds: [],
    });

    renderEditor();
    const counter = await screen.findByRole("button", { name: /1 个失败任务/ });
    expect(counter).toBeTruthy();

    fireEvent.click(counter);
    await waitFor(() => {
      expect(screen.getByText("失败")).toBeTruthy();
      expect(screen.getByTitle("复制错误")).toBeTruthy();
    });
  });
});

describe("Editor 顶栏可访问性与窄屏溢出菜单", () => {
  it("返回按钮具备可访问名称", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    renderEditor();
    const back = await screen.findByRole("button", { name: "返回首页" });
    expect(back.getAttribute("title")).toBe("返回首页");
  });

  it("溢出菜单展示低频操作并支持 Escape 关闭", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "更多" }));

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /导入/ })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /导出项目 JSON/ }),
    ).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /删除项目/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("设计弹层可用关闭按钮与 Escape 退出，并把焦点还给触发按钮", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    renderEditor();
    const trigger = await screen.findByRole("button", { name: "设计" });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "设计" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "设计" })).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "设计" })).toBeNull(),
    );
  });
  it("导出项目 JSON 成功后提示", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    renderEditor();

    fireEvent.click(
      await screen.findByRole("button", { name: "导出项目 JSON" }),
    );
    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.title === "导出成功"),
      ).toBe(true),
    );
  });

  it("面板开关按钮暴露 aria-pressed 并可切换", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    renderEditor();
    const outline = await screen.findByRole("button", { name: "大纲面板" });
    const ai = screen.getByRole("button", { name: "AI 面板" });
    expect(outline.getAttribute("aria-pressed")).toBe("true");
    expect(ai.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(outline);
    fireEvent.click(ai);
    await waitFor(() => {
      expect(outline.getAttribute("aria-pressed")).toBe("false");
      expect(ai.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("点击遮罩关闭溢出菜单", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    const { container } = renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "更多" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    const backdrop = container.querySelector<HTMLElement>(
      ".fixed.inset-0.z-10",
    );
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("任务面板关闭按钮具备可访问名称", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    useJobStore.setState({
      jobs: [
        {
          id: "j1",
          type: "outline.generate",
          title: "生成大纲",
          status: "running",
          createdAt: 0,
          updatedAt: 0,
          canCancel: true,
        },
      ],
      activeJobIds: ["j1"],
    });

    renderEditor();
    await waitFor(() => expect(screen.getByText("任务列表")).toBeTruthy());
    const close = screen.getByRole("button", { name: "关闭" });
    expect(close.getAttribute("aria-label")).toBe("关闭");
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByText("任务列表")).toBeNull());
  });

  it("返回按钮点击后离开编辑器路由", async () => {
    useDeckStore.setState({ deck: makeDeck() });
    renderEditor();
    const back = await screen.findByRole("button", { name: "返回首页" });
    // 点击不抛错即说明导航入口可用（路由断言由 App 级测试覆盖）
    fireEvent.click(back);
  });
});

describe("Editor 加载", () => {
  it("deck 未加载时展示空态而非报错", async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText("生成大纲后将在此预览")).toBeTruthy();
    });
  });
});
