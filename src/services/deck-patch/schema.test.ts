import { describe, expect, it } from "vitest";
import { deckPatchSchema } from "./schema";

describe("deck-patch schema 图片来源", () => {
  it("接受 web 来源（搜图/上传内嵌后的 data URL），不再校验失败", () => {
    const result = deckPatchSchema.safeParse({
      op: "update_slide",
      slideId: "s1",
      patch: {
        image: {
          type: "web",
          url: "data:image/png;base64,AAA",
          alt: "城市天际线",
          attribution: "Ann / flickr · BY 4.0",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("拒绝未知来源值", () => {
    const result = deckPatchSchema.safeParse({
      op: "update_slide",
      slideId: "s1",
      patch: { image: { type: "ftp", url: "x", alt: "y" } },
    });
    expect(result.success).toBe(false);
  });
});
