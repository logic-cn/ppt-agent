import { describe, expect, it } from "vitest";
import { decideRecovery } from "@/services/recovery";

describe("decideRecovery", () => {
  it("outline: 第 1 次尝试应当重试", () => {
    expect(decideRecovery("outline", 0)).toBe("retry");
  });

  it("outline: 达到重试上限应当降级", () => {
    expect(decideRecovery("outline", 2)).toBe("degrade-rulebased");
  });

  it("content: 第 2 次尝试应当重试", () => {
    expect(decideRecovery("content", 1)).toBe("retry");
  });

  it("image: 早期尝试应当重试", () => {
    expect(decideRecovery("image", 0)).toBe("retry");
  });

  it("image: 达到重试上限应当降级为规则占位", () => {
    expect(decideRecovery("image", 2)).toBe("degrade-rulebased");
  });
});
