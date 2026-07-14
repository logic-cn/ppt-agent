import { describe, it, expect } from "vitest";
import { repairDeck } from "./deck-repair";
import type { Deck } from "@/types/deck";

describe("deck-repair palette 兜底", () => {
  it("custom-* 配色予以保留（交由 resolveTheme 解析/兜底）", () => {
    const deck = {
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "custom-ghost",
      },
    } as unknown as Deck;
    const fixed = repairDeck(deck);
    expect(fixed.deck.design.palette).toBe("custom-ghost");
  });

  it("非 custom 的无效 palette 回退默认", () => {
    const deck = {
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "ghost-blue",
      },
    } as unknown as Deck;
    const fixed = repairDeck(deck);
    expect(fixed.deck.design.palette).toBe("business-blue");
  });
});
