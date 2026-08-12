import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Deck } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import { useJobStore } from "@/store/job";
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

describe("Editor 加载", () => {
  it("deck 未加载时展示空态而非报错", async () => {
    renderEditor();
    await waitFor(() => {
      expect(screen.getByText("生成大纲后将在此预览")).toBeTruthy();
    });
  });
});
