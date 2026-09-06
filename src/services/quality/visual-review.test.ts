// 视觉自检服务测试（D3）：mock chat 与栅格化
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/llm", () => ({ chat: vi.fn() }));
vi.mock("@/engine/svg/rasterize", () => ({
  rasterizeSvg: vi.fn(async () => "data:image/jpeg;base64,FAKE"),
}));

import { chat } from "@/services/llm";
import { reviewSlideVisual } from "./visual-review";
import { buildSpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

const spec = buildSpecLock(DEFAULT_DESIGN);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reviewSlideVisual", () => {
  it("通过页返回 pass 且不携带 issues", async () => {
    vi.mocked(chat).mockResolvedValue({ content: '{"pass": true}' } as never);
    const r = await reviewSlideVisual({ svg: "<svg/>", specLock: spec });
    expect(r.pass).toBe(true);
    expect(r.issues).toHaveLength(0);
    // 视觉消息：user content 为 parts 数组，含图片
    const req = vi.mocked(chat).mock.calls[0][0];
    const user = req.messages.find((m) => m.role === "user")!;
    expect(Array.isArray(user.content)).toBe(true);
    expect(JSON.stringify(user.content)).toContain("image_url");
  });

  it("不通过页解析 issues", async () => {
    vi.mocked(chat).mockResolvedValue({
      content:
        '{"pass": false, "issues": ["左下角文字与背景对比度不足，改用 text 色"]}',
    } as never);
    const r = await reviewSlideVisual({ svg: "<svg/>", specLock: spec });
    expect(r.pass).toBe(false);
    expect(r.issues[0]).toContain("对比度");
  });

  it("非法 JSON 时跳过该页（pass=true + error 注记）", async () => {
    vi.mocked(chat).mockResolvedValue({ content: "模型嘟囔了一堆" } as never);
    const r = await reviewSlideVisual({ svg: "<svg/>", specLock: spec });
    expect(r.pass).toBe(true);
    expect(r.error).toBeTruthy();
  });

  it("代码块包裹的 JSON 也能解析", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: '```json\n{"pass": false, "issues": ["标题被裁切"]}\n```',
    } as never);
    const r = await reviewSlideVisual({ svg: "<svg/>", specLock: spec });
    expect(r.pass).toBe(false);
    expect(r.issues).toEqual(["标题被裁切"]);
  });
});
