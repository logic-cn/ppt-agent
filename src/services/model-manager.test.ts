// model-manager：Tauri IPC 封装的单测（invoke/listen 全部 mock）
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listen(...args),
}));

import {
  MODEL_REGISTRY,
  checkInstalled,
  downloadModel,
  deleteModel,
  loadModel,
  unloadModel,
  getLoadStatus,
  formatGB,
  isTauriRuntime,
} from "./model-manager";
import type { DownloadProgressEvent } from "./model-manager";

beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("isTauriRuntime", () => {
  it("有 __TAURI_INTERNALS__ 时为 true，否则 false", () => {
    expect(isTauriRuntime()).toBe(true);
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    expect(isTauriRuntime()).toBe(false);
  });
});

describe("MODEL_REGISTRY", () => {
  it("standard 档对应已核实的 MiniCPM5-2B Q4_K_M 制品", () => {
    expect(MODEL_REGISTRY.standard.fileName).toBe(
      "MiniCPM5-2B-Q4_K_M.gguf",
    );
    expect(MODEL_REGISTRY.standard.sizeBytes).toBe(1_561_318_368);
    expect(MODEL_REGISTRY.standard.sha256).toHaveLength(64);
    expect(MODEL_REGISTRY.standard.urls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("checkInstalled / deleteModel", () => {
  it("非 Tauri 环境安全降级（null / false），不发 IPC", async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    expect(await checkInstalled(MODEL_REGISTRY.standard)).toBeNull();
    expect(await deleteModel(MODEL_REGISTRY.standard)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("透传 fileName 到 model_installed / model_delete", async () => {
    invoke.mockResolvedValue({ path: "/m/f.gguf", size_bytes: 1 });
    const info = await checkInstalled(MODEL_REGISTRY.light);
    expect(info?.path).toBe("/m/f.gguf");
    expect(invoke).toHaveBeenNthCalledWith(1, "model_installed", {
      fileName: MODEL_REGISTRY.light.fileName,
    });

    invoke.mockResolvedValue(true);
    await expect(deleteModel(MODEL_REGISTRY.light)).resolves.toBe(true);
  });
});

describe("downloadModel", () => {
  const def = MODEL_REGISTRY.standard;
  const progress = (over: Partial<DownloadProgressEvent> = {}) => ({
    file_name: def.fileName,
    source_index: 0,
    downloaded: 1,
    total: 2,
    phase: "downloading",
    ...over,
  });

  it("订阅进度事件、按 file_name 过滤、完成后解绑", async () => {
    const unlisten = vi.fn();
    let handler: ((e: { payload: DownloadProgressEvent }) => void) | null =
      null;
    listen.mockImplementation(
      async (
        _ev: string,
        cb: (e: { payload: DownloadProgressEvent }) => void,
      ) => {
        handler = cb;
        return unlisten;
      },
    );
    const onProgress = vi.fn();
    invoke.mockResolvedValue({
      path: "/m/x.gguf",
      size_bytes: 123,
      source_index: 1,
    });

    const res = await downloadModel(def, onProgress);
    expect(invoke).toHaveBeenCalledWith("model_download", {
      opts: { urls: def.urls, file_name: def.fileName, sha256: def.sha256 },
    });
    expect(res.source_index).toBe(1);
    expect(unlisten).toHaveBeenCalledOnce();

    handler!({ payload: progress() });
    expect(onProgress).toHaveBeenCalledWith(progress());
    handler!({
      payload: progress({ file_name: "other.gguf" }),
    });
    expect(onProgress).toHaveBeenCalledTimes(1); // 非本模型事件被过滤
  });

  it("下载失败时仍解绑进度监听", async () => {
    const unlisten = vi.fn();
    listen.mockResolvedValue(unlisten);
    invoke.mockRejectedValue(new Error("网络中断"));
    await expect(
      downloadModel(def, vi.fn()),
    ).rejects.toThrow("网络中断");
    expect(unlisten).toHaveBeenCalledOnce();
  });
});

describe("load/unload/status 透传", () => {
  it("调用对应命令并返回状态", async () => {
    const dto = { loaded: true, model_path: "/m/x.gguf", ctx_size: 16384 };
    invoke.mockResolvedValue(dto);
    await expect(loadModel("/m/x.gguf", 16384)).resolves.toEqual(dto);
    expect(invoke).toHaveBeenLastCalledWith("local_llm_load", {
      modelPath: "/m/x.gguf",
      ctxSize: 16384,
    });
    await expect(unloadModel()).resolves.toEqual(dto);
    expect(invoke).toHaveBeenLastCalledWith("local_llm_unload");
    await expect(getLoadStatus()).resolves.toEqual(dto);
    expect(invoke).toHaveBeenLastCalledWith("local_llm_status");
  });
});

describe("formatGB", () => {
  it("按 GiB 保留两位小数", () => {
    expect(formatGB(1_561_318_368)).toBe("1.45 GB");
    expect(formatGB(0)).toBe("0.00 GB");
  });
});
