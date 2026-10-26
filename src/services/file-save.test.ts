import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveMock, invokeMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  invokeMock: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { saveTextFile } from "./file-save";

const base = {
  content: '{"a":1}',
  defaultName: "deck.json",
  extension: "json",
  label: "PPT Agent project",
};

describe("saveTextFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("Tauri 环境经对话框选路后写盘", async () => {
    saveMock.mockResolvedValue("/tmp/deck.json");
    invokeMock.mockResolvedValue(undefined);
    const result = await saveTextFile(base);
    expect(result).toBe("saved");
    expect(invokeMock).toHaveBeenCalledWith("write_text_file", {
      path: "/tmp/deck.json",
      content: '{"a":1}',
    });
  });

  it("用户取消返回 null 且不写盘", async () => {
    saveMock.mockResolvedValue(null);
    expect(await saveTextFile(base)).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("写盘失败抛给调用方，不伪装成下载成功", async () => {
    saveMock.mockResolvedValue("/tmp/deck.json");
    invokeMock.mockRejectedValue(new Error("磁盘已满"));
    await expect(saveTextFile(base)).rejects.toThrow("磁盘已满");
  });

  it("对话框不可用时回退浏览器下载", async () => {
    saveMock.mockRejectedValue(new Error("dialog 未注册"));
    expect(await saveTextFile(base)).toBe("downloaded");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
