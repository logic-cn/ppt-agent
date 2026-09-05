import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Deck, Slide } from "@/types/deck";
import type { DeckPatch } from "@/services/deck-patch/types";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import type { GenerationOptions } from "@/types/generation";

vi.mock("@/engine/svg/pipeline", () => ({
  buildDeckSvgs: vi.fn(async () => ({
    deck: {
      id: "x1-temp",
      slides: [],
    },
    slides: [],
  })),
}));
vi.mock("@/services/deck-patch/ai", () => ({
  generateDeckPatches: vi.fn(),
}));
vi.mock("@/services/deck-patch/apply", () => ({
  applyDeckPatches: vi.fn(),
}));
vi.mock("@/services/generation/first-page-gate", () => ({
  runFirstPageGate: vi.fn(() => []),
}));

import { buildDeckSvgs } from "@/engine/svg/pipeline";
import { generateDeckPatches } from "@/services/deck-patch/ai";
import { applyDeckPatches } from "@/services/deck-patch/apply";
import { ChatPanel } from "./chat-panel";

function makeDeck(slides: Slide[] = []): Deck {
  return {
    id: "test-deck",
    version: 2,
    title: "测试演示",
    design: {
      mode: "briefing",
      visualStyle: "soft-rounded",
      palette: "business-blue",
    },
    slides,
    createdAt: 0,
    updatedAt: 0,
  };
}

function slide(id: string): Slide {
  return { id, layout: "content", title: `标题 ${id}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  useQualityStore.setState({ report: null, pendingRules: undefined });
});

describe("ChatPanel 主题生成分支", () => {
  it("主题请求走 buildDeckSvgs 并输出页数摘要", async () => {
    useDeckStore.setState({ deck: makeDeck([slide("s1")]) });
    vi.mocked(buildDeckSvgs).mockResolvedValue({
      deck: makeDeck([slide("s1"), slide("s2")]),
      slides: [slide("s1"), slide("s2")],
    } as never);

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, {
      target: { value: "生成一份关于 AI 行业的 PPT" },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(buildDeckSvgs).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/已生成.*2.*页大纲/)).toBeTruthy();
    });
  });

  it("非主题请求不触发 buildDeckSvgs", async () => {
    useDeckStore.setState({ deck: makeDeck([slide("s1")]) });
    render(<ChatPanel />);
    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(buildDeckSvgs).not.toHaveBeenCalled();
    });
  });
});

describe("ChatPanel patch 确认流", () => {
  it("修改指令生成 patches 并展示摘要与确认按钮", async () => {
    const deck = makeDeck([slide("s1")]);
    useDeckStore.setState({ deck });
    const patches: DeckPatch[] = [{ op: "set_deck_title", title: "新标题" }];
    vi.mocked(generateDeckPatches).mockResolvedValue(patches);

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, { target: { value: "把标题改成新标题" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(generateDeckPatches).toHaveBeenCalledWith(
        expect.objectContaining({ userRequest: "把标题改成新标题" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/检测到.*1.*个操作/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "应用修改" })).toBeTruthy();
  });

  it("点击应用修改后调用 applyDeckPatches 并提示成功", async () => {
    const deck = makeDeck([slide("s1")]);
    useDeckStore.setState({ deck });
    vi.mocked(generateDeckPatches).mockResolvedValue([
      { op: "set_deck_title", title: "新标题" },
    ]);
    vi.mocked(applyDeckPatches).mockImplementation((d, patches) => ({
      deck: { ...d, title: (patches[0] as { title: string }).title },
      applied: [
        { op: "set_deck_title", title: "新标题", description: "重命名标题" },
      ],
      warnings: [],
    }));

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, { target: { value: "把标题改成新标题" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "应用修改" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "应用修改" }));

    await waitFor(() => {
      expect(applyDeckPatches).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/已应用修改/)).toBeTruthy();
    });
    expect(useDeckStore.getState().deck!.title).toBe("新标题");
  });

  it("无 patch 时提示无需修改", async () => {
    useDeckStore.setState({ deck: makeDeck([slide("s1")]) });
    vi.mocked(generateDeckPatches).mockResolvedValue([]);

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, { target: { value: "帮我检查一下" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/当前没有需要修改的内容/)).toBeTruthy();
    });
  });
});

describe("ChatPanel 生成设置（路线图 §7.3）", () => {
  it("生成参数与界面语言映射随主题请求传入 buildDeckSvgs", async () => {
    useDeckStore.setState({ deck: makeDeck([slide("s1")]) });
    vi.mocked(buildDeckSvgs).mockResolvedValue({
      deck: makeDeck([slide("s1")]),
      slides: [slide("s1")],
    } as never);

    render(<ChatPanel />);
    // 展开「选项」面板并设置场景/受众/页数
    fireEvent.click(screen.getByText("选项"));
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "pitch" },
    });
    fireEvent.change(screen.getByPlaceholderText(/投资人、新员工/), {
      target: { value: "投资人" },
    });
    fireEvent.change(screen.getByLabelText("页数"), {
      target: { value: "12" },
    });

    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, {
      target: { value: "生成一份关于 AI 行业的 PPT" },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(buildDeckSvgs).toHaveBeenCalled();
    });
    const callOpts = vi.mocked(buildDeckSvgs).mock.calls[0][2] as {
      options: GenerationOptions;
    };
    expect(callOpts.options).toMatchObject({
      scenario: "pitch",
      audience: "投资人",
      pageCount: 12,
      language: "zh-CN",
    });
  });

  it("未设置任何选项时仅注入界面语言", async () => {
    useDeckStore.setState({ deck: makeDeck([slide("s1")]) });
    vi.mocked(buildDeckSvgs).mockResolvedValue({
      deck: makeDeck([slide("s1")]),
      slides: [slide("s1")],
    } as never);

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText(/输入指令/);
    fireEvent.change(input, {
      target: { value: "生成一份关于 AI 行业的 PPT" },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(buildDeckSvgs).toHaveBeenCalled();
    });
    const callOpts = vi.mocked(buildDeckSvgs).mock.calls[0][2] as {
      options: GenerationOptions;
    };
    expect(callOpts.options).toEqual({ language: "zh-CN" });
  });
});
