import { describe, expect, it } from "vitest";
import { checkForUpdate, getAppVersion, isTauriRuntime } from "./updater";

describe("updater", () => {
  it("非 Tauri 环境下判定为不支持自动更新", async () => {
    expect(isTauriRuntime()).toBe(false);
    await expect(checkForUpdate()).resolves.toEqual({
      status: "unsupported",
    });
    await expect(getAppVersion()).resolves.toBeNull();
  });
});
