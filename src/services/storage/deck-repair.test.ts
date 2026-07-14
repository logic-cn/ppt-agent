import { describe, it, expect } from "vitest";
import { repairDeck } from "./deck-repair";
import type { Deck } from "@/types/deck";

describe("deck-repair 旧自定义主题兜底", () => {
  it("design.palette 为 custom-* 时回退默认 palette", () => {
    const deck = {
      design: {
        mode: "briefing",
        visualStyle: "soft-rounded",
        palette: "custom-ghost",
      },
    } as unknown as Deck;
    const fixed = repairDeck(deck);
    expect(fixed.deck.design.palette).toBe("business-blue");
  });
});
