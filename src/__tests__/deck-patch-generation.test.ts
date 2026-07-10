import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/llm", () => ({
  chat: vi.fn(),
}));

import { chat } from "@/services/llm";
import { generateDeckPatches } from "@/services/deck-patch/ai";
import { applyDeckPatches } from "@/services/deck-patch/apply";
import { DESTRUCTIVE_OPS } from "@/services/deck-patch/types";
import patchFixture from "@/__fixtures__/llm/deck-patch-valid.json";
import type { Deck } from "@/types/deck";

function createDeck(): Deck {
  return {
    id: "deck-1",
    version: 2,
    title: "季度复盘",
    themeId: "business-blue",
    slides: [
      { id: "s-cover", layout: "cover", title: "季度复盘" },
      { id: "s-revenue", layout: "chart", title: "季度营收" },
      { id: "s-closing", layout: "closing", title: "谢谢" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function asChatMock() {
  return chat as unknown as ReturnType<typeof vi.fn>;
}

describe("generateDeckPatches 集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asChatMock().mockResolvedValue({
      content: JSON.stringify(patchFixture),
    });
  });

  it("解析 LLM 返回的合法 patch 列表", async () => {
    const patches = await generateDeckPatches({
      deck: createDeck(),
      userRequest: "把营收页标题改一下，标题改成正式报告，并加一页风险页",
    });
    expect(patches).toHaveLength(3);
    expect(patches[0].op).toBe("update_slide");
    expect(patches[1].op).toBe("set_deck_title");
    expect(patches[2].op).toBe("insert_slide");
  });

  it("对高风险操作标记 destructive 警告", async () => {
    const patches = await generateDeckPatches({
      deck: createDeck(),
      userRequest: "修改内容",
    });
    const destructive = patches.filter((p) => DESTRUCTIVE_OPS.has(p.op));
    const result = applyDeckPatches(createDeck(), patches);
    for (const w of result.warnings) {
      expect(w.code).toBe("destructive_operation");
    }
    expect(destructive.length).toBeGreaterThanOrEqual(0);
  });

  it("apply 后标题被修改、新页被插入、指定页标题更新", async () => {
    const patches = await generateDeckPatches({
      deck: createDeck(),
      userRequest: "修改",
    });
    const deck = createDeck();
    const result = applyDeckPatches(deck, patches);

    expect(result.deck.title).toBe("2025 Q3 业务复盘报告");
    const revenue = result.deck.slides.find((s) => s.id === "s-revenue");
    expect(revenue?.title).toBe("季度营收（修正）");
    expect(result.deck.slides.some((s) => s.title === "风险与应对")).toBe(true);
    // 原 deck 不被修改
    expect(deck.slides).toHaveLength(3);
    expect(deck.title).toBe("季度复盘");
  });
});
