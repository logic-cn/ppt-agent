import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useDeckStore } from "@/store/deck";
import { useProjectStore } from "@/store/project";
import { useToastStore } from "@/store/toast";
import { deleteDeck, listDecks, loadDeck } from "@/services/storage";
import { saveTextFile } from "@/services/file-save";
import { importDeckJson } from "@/services/project-backup";

vi.mock("@/services/storage", () => ({
  deleteDeck: vi.fn(),
  loadDeck: vi.fn(),
  listDecks: vi.fn(async () => []),
  isUntitledDeck: vi.fn(() => false),
}));
vi.mock("@/services/project-backup", () => ({
  importDeckJson: vi.fn(),
  serializeDeckJson: vi.fn(() => "{}"),
}));
vi.mock("@/services/file-save", () => ({ saveTextFile: vi.fn() }));
vi.mock("@/components/preset/PresetLibraryDialog", () => ({
  PresetLibraryDialog: () => null,
}));
vi.mock("@/components/settings/SettingsDialog", () => ({
  SettingsDialog: () => null,
}));

import Home from "./Home";

const meta = {
  id: "p1",
  title: "待删除项目",
  slidesCount: 3,
  createdAt: 0,
  updatedAt: 0,
};

function makeDeck() {
  return {
    id: "p1",
    version: 2,
    title: "待删除项目",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">{location.pathname + location.search}</span>
  );
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
  useProjectStore.setState({ recent: [], loading: false });
  useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
});

describe("Home 项目入口", () => {
  it("新建空白项目会创建并跳转到编辑器", async () => {
    const createDeck = vi.fn(async () => ({
      id: "new-blank",
      title: "未命名",
    }));
    useDeckStore.setState({ createDeck: createDeck as never });
    renderHome();

    fireEvent.click(screen.getByText("新建空白项目"));
    await waitFor(() => expect(createDeck).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/editor/new-blank?new=1",
      ),
    );
  });

  it("导入文档入口会新建空白项目并以导入模式进入编辑器", async () => {
    const createDeck = vi.fn(async () => ({
      id: "new-import",
      title: "未命名",
    }));
    useDeckStore.setState({ createDeck: createDeck as never });
    renderHome();

    fireEvent.click(screen.getByText("导入文档"));
    await waitFor(() => expect(createDeck).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/editor/new-import?import=1",
      ),
    );
  });
});

describe("Home 项目操作", () => {
  it("导入项目 JSON 成功后跳转并提示修复警告", async () => {
    vi.mocked(importDeckJson).mockResolvedValue({
      deck: { id: "imported", title: "导入项目" },
      warnings: ["已自动修复封面"],
    } as never);
    renderHome();

    const file = new File(["{}"], "project.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText("导入项目 JSON"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/editor/imported",
      ),
    );
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.title === "项目已修复"),
      ).toBe(true),
    );
  });

  it("导出项目 JSON 成功后提示", async () => {
    vi.mocked(listDecks).mockResolvedValue([meta]);
    vi.mocked(loadDeck).mockResolvedValue(makeDeck() as never);
    vi.mocked(saveTextFile).mockResolvedValue({
      path: "/tmp/p1.json",
    } as never);
    renderHome();

    fireEvent.click(await screen.findByTitle("导出项目 JSON"));
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.title === "项目已导出"),
      ).toBe(true),
    );
  });

  it("删除成功后会刷新列表并关闭确认框", async () => {
    vi.mocked(listDecks)
      .mockResolvedValueOnce([meta])
      .mockResolvedValueOnce([]);
    vi.mocked(deleteDeck).mockResolvedValue(undefined);
    renderHome();

    fireEvent.click(await screen.findByTitle("删除项目"));
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));

    await waitFor(() => expect(deleteDeck).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("删除失败时提示错误并保留确认框，便于重试", async () => {
    vi.mocked(listDecks).mockResolvedValue([meta]);
    vi.mocked(deleteDeck).mockRejectedValue(new Error("磁盘只读"));
    renderHome();

    fireEvent.click(await screen.findByTitle("删除项目"));
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));

    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.message === "磁盘只读"),
      ).toBe(true),
    );
    // 失败后确认框仍在，用户可以直接重试
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
