// generateDeckPatches：格式失败 → 带反馈重试的回归测试
// （端侧小模型曾把 op 写成非法值直接抛原始 zod 报错给用户）
import { describe, it, expect, vi, beforeEach } from "vitest";

const chat = vi.fn();

vi.mock("@/services/llm", () => ({
  chat: (...args: unknown[]) => chat(...args),
}));

import { generateDeckPatches } from "./ai";
import type { Deck } from "@/types/deck";

const deck = {
  title: "T",
  slides: [{ id: "s1", layout: "content", title: "A" }],
  design: { palette: "p" },
} as unknown as Deck;

const okJson = JSON.stringify({
  patches: [{ op: "set_deck_title", title: "新标题" }],
});

beforeEach(() => chat.mockReset());

describe("generateDeckPatches", () => {
  it("op 非法时带错误摘要重试，第二次成功", async () => {
    chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          patches: [{ op: "update", slideId: "s1", patch: {} }],
        }),
      })
      .mockResolvedValueOnce({ content: okJson });

    const patches = await generateDeckPatches({ deck, userRequest: "改标题" });

    expect(patches).toEqual([{ op: "set_deck_title", title: "新标题" }]);
    expect(chat).toHaveBeenCalledTimes(2);
    const retryUserMsg = chat.mock.calls[1][0].messages[1].content;
    expect(retryUserMsg).toContain("格式错误");
    expect(retryUserMsg).toContain("op 只能取");
    // 不应把原始 zod JSON 倾倒进反馈
    expect(retryUserMsg).not.toContain("invalid_union");
  });

  it("传给本地模型的 jsonSchema 含 op 枚举约束", async () => {
    chat.mockResolvedValueOnce({ content: okJson });
    await generateDeckPatches({ deck, userRequest: "改标题" });
    const req = chat.mock.calls[0][0];
    const grammar = JSON.stringify(req.jsonSchema);
    expect(grammar).toContain("set_deck_title");
    expect(grammar).toContain("merge_slides");
    expect(grammar).toContain("anyOf");
  });

  it("重试耗尽后抛简短中文错误（非原始 zod JSON）", async () => {
    chat.mockResolvedValue({
      content: JSON.stringify({
        patches: [{ op: "edit", slideId: "s1", patch: {} }],
      }),
    });

    await expect(
      generateDeckPatches({ deck, userRequest: "改标题" }),
    ).rejects.toThrow("AI 生成的修改方案格式不正确（已重试）");
    expect(chat).toHaveBeenCalledTimes(3);
  });
});
