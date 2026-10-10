import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDeckSvgs } from "./pipeline";
import { svgToPptx } from "@/engine/pptx-translator";
import { validateSvgContract } from "./spec-contract";
import { DEFAULT_DESIGN } from "@/types/design";
import type { Deck } from "@/types/deck";

const MOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect x="100" y="80" width="400" height="160" rx="12" fill="#1A56DB"/>
  <text x="120" y="160" font-size="40" fill="#FFFFFF" text-anchor="start" font-family="sans-serif">示例标题</text>
</svg>`;

const MOCK_PLAN = [
  { role: "cover", title: "封面", intent: "引入主题" },
  { role: "content", title: "内容页", intent: "展开要点" },
];

vi.mock("@/services/llm", () => ({
  chat: vi.fn(
    async (
      _req: { messages: { content: string }[] },
      kind: string = "outline",
    ) => {
      // 基于 chat 第二参数 kind 分流：pagePlan 用 "outline"，svg 生成用 "svg"
      if (kind === "svg") {
        return { content: MOCK_SVG };
      }
      return {
        content: JSON.stringify({
          pages: [
            { role: "cover", title: "封面", intent: "引入主题" },
            { role: "content", title: "内容页", intent: "展开要点" },
          ],
        }),
      };
    },
  ),
  isLocalModelActive: vi.fn(() => false),
}));

describe("X1 管线端到端联调", () => {
  let deck: Deck;

  beforeEach(() => {
    deck = {
      id: "d1",
      title: "端到端测试 Deck",
      design: DEFAULT_DESIGN,
      slides: [],
      version: 2,
      createdAt: 0,
      updatedAt: 0,
    };
  });

  it("buildDeckSvgs 产出每页带 svg 且通过契约校验", async () => {
    const newDeck = await buildDeckSvgs(deck, deck.design, {
      topic: deck.title,
    });

    expect(newDeck.slides.length).toBe(MOCK_PLAN.length);
    for (const slide of newDeck.slides) {
      expect(slide.svg).toBeTruthy();
      expect(slide.svg!.length).toBeGreaterThan(0);
      expect(validateSvgContract(slide.svg!)).toHaveLength(0);
    }
  });

  it("svg → pptx 导出链路打通（Blob size>1000）", async () => {
    const newDeck = await buildDeckSvgs(deck, deck.design, {
      topic: deck.title,
    });
    const blob = await svgToPptx(newDeck.slides, newDeck.design);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
