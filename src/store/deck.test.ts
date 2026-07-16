import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Deck } from "@/types/deck";
import { useDeckStore } from "./deck";

// mock executor，使其返回固定 svg，避免真实调用 LLM
vi.mock("@/engine/svg/executor", () => ({
  generateSlideSvg: vi.fn(async () => {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#fff"/><text x="10" y="40" font-size="32" fill="#111">重画的页面</text></svg>`;
  }),
  generateDeckSvgs: vi.fn(),
}));

import { generateSlideSvg } from "@/engine/svg/executor";

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
      {
        id: "s1",
        layout: "content",
        title: "第一页标题",
        // 故意不携带 svg，用于验证 regenerate 会写入
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("regenerateSlide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeckStore.setState({ deck: null, past: [], future: [], dirty: false });
  });

  it("调用 executor 并将生成结果写回对应 slide.svg", async () => {
    const deck = makeDeck();
    useDeckStore.setState({ deck });

    await useDeckStore.getState().regenerateSlide("s1");

    // executor 应被调用一次
    expect(generateSlideSvg).toHaveBeenCalledTimes(1);

    const updated = useDeckStore.getState().deck!;
    expect(updated.slides[0].svg).toContain("重画的页面");
    expect(updated.slides[0].svg).toContain('viewBox="0 0 1280 720"');
  });

  it("找不到 slide 时不应抛错也不修改 deck", async () => {
    const deck = makeDeck();
    useDeckStore.setState({ deck });

    await expect(
      useDeckStore.getState().regenerateSlide("not-exist"),
    ).resolves.toBeUndefined();

    expect(generateSlideSvg).not.toHaveBeenCalled();
  });
});
