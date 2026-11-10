import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Deck } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import { useSettingsStore } from "@/store/settings";
import { InspectorPanel } from "./inspector-panel";

vi.mock("@/components/chat", () => ({ ChatPanel: () => <div>AI 内容</div> }));
vi.mock("./slide-tab", () => ({ SlideTab: () => <div>页面内容</div> }));
vi.mock("./chart-tab", () => ({ ChartTab: () => <div>图表内容</div> }));
vi.mock("./image-tab", () => ({ ImageTab: () => <div>配图内容</div> }));
vi.mock("./notes-tab", () => ({ NotesTab: () => <div>备注内容</div> }));

// 生成服务与任务编排都走 mock，避免测试里触发真实模型调用
const { generateSlideContentMock } = vi.hoisted(() => ({
  generateSlideContentMock: vi.fn(async () => ({ body: "生成的正文" })),
}));
vi.mock("@/services/content", () => ({
  generateSlideContent: generateSlideContentMock,
  buildContentContext: vi.fn(() => ({})),
}));
const { runJobMock } = vi.hoisted(() => ({ runJobMock: vi.fn() }));
vi.mock("@/store/job", () => ({ runJob: runJobMock }));

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
      { id: "s1", layout: "cover", title: "封面" },
      { id: "s2", layout: "content", title: "内容页" },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

function getTabs() {
  return within(screen.getByRole("tablist")).getAllByRole("tab");
}

describe("InspectorPanel ARIA Tabs", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLang("zh");
    useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
    useQualityStore.setState({ report: null, pendingRules: null });
    runJobMock.mockReset();
    // 用最小 job 形状驱动 runJob 内部回调
    runJobMock.mockImplementation(
      async (
        _meta: unknown,
        task: (job: {
          id: string;
          signal: AbortSignal;
          update: (p: unknown) => void;
        }) => Promise<unknown>,
      ) =>
        task({
          id: "j1",
          signal: new AbortController().signal,
          update: vi.fn(),
        }),
    );
    generateSlideContentMock.mockClear();
  });

  it("tab 与 tabpanel 通过 id / aria-controls / aria-labelledby 关联", () => {
    render(<InspectorPanel deck={makeDeck()} selectedIndex={0} />);
    const tabs = getTabs();
    const panel = screen.getByRole("tabpanel");

    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[0].getAttribute("tabindex")).toBe("0");
    expect(tabs[1].getAttribute("tabindex")).toBe("-1");
    expect(tabs[0].getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0].id);
  });

  it("方向键切换选中并移动焦点，roving tabindex 同步更新", () => {
    render(<InspectorPanel deck={makeDeck()} selectedIndex={0} />);
    const tablist = screen.getByRole("tablist");
    const tabs = getTabs();

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("tabindex")).toBe("0");
    expect(tabs[0].getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      tabs[1].id,
    );

    // 从左端反向循环到最后一页
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(tabs[tabs.length - 1].getAttribute("aria-selected")).toBe("true");

    // Home / End 跳到首尾
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tablist, { key: "End" });
    expect(tabs[tabs.length - 1].getAttribute("aria-selected")).toBe("true");
  });

  it("点击 tab 保持原有选中逻辑", () => {
    render(<InspectorPanel deck={makeDeck()} selectedIndex={0} />);
    const tabs = getTabs();
    fireEvent.click(tabs[2]);
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("图表内容")).toBeTruthy();
  });

  it("无选中页时，各页级 tab 展示空状态", () => {
    render(<InspectorPanel deck={makeDeck()} selectedIndex={-1} />);
    const tabs = getTabs();
    for (const index of [1, 2, 3, 4]) {
      fireEvent.click(tabs[index]);
      expect(screen.getByText("请选择一页")).toBeTruthy();
    }
  });

  it("单页生成成功后写回幻灯片并刷新质量报告", async () => {
    const deck = makeDeck();
    useDeckStore.setState({ deck });
    render(<InspectorPanel deck={deck} selectedIndex={1} />);

    fireEvent.click(getTabs()[1]);
    fireEvent.click(screen.getByRole("button", { name: /AI 生成本页/ }));

    await waitFor(() =>
      expect(generateSlideContentMock).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(useDeckStore.getState().deck!.slides[1].body).toBe("生成的正文"),
    );
    expect(useQualityStore.getState().report).not.toBeNull();
  });

  it("批量填充只为空内容页生成并写回", async () => {
    const deck = makeDeck();
    useDeckStore.setState({ deck });
    render(<InspectorPanel deck={deck} selectedIndex={1} />);

    fireEvent.click(getTabs()[1]);
    fireEvent.click(screen.getByRole("button", { name: /AI 填充全部空页/ }));

    // 封面页不参与批量填充，仅内容页调用一次
    await waitFor(() =>
      expect(generateSlideContentMock).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(useDeckStore.getState().deck!.slides[1].body).toBe("生成的正文"),
    );
    expect(useDeckStore.getState().deck!.slides[0].body).toBeUndefined();
  });
});
