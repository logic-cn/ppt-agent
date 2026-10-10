// model store：启动自动加载（bootstrap）的门控逻辑单测
import { describe, it, expect, vi, beforeEach } from "vitest";

const loadModel = vi.fn();
const checkInstalled = vi.fn();
const getLoadStatus = vi.fn();
const isTauriRuntime = vi.fn(() => true);

vi.mock("@/services/model-manager", () => ({
  MODEL_REGISTRY: {
    standard: { ctxSize: 16384, sizeBytes: 1 },
    light: { ctxSize: 8192, sizeBytes: 1 },
  },
  checkInstalled: (...a: unknown[]) => checkInstalled(...a),
  deleteModel: vi.fn(),
  downloadModel: vi.fn(),
  getLoadStatus: (...a: unknown[]) => getLoadStatus(...a),
  isTauriRuntime: () => isTauriRuntime(),
  loadModel: (...a: unknown[]) => loadModel(...a),
  unloadModel: vi.fn(),
}));

import { useModelStore } from "./model";
import { useSettingsStore } from "./settings";

beforeEach(() => {
  loadModel.mockReset();
  checkInstalled.mockReset();
  getLoadStatus.mockReset();
  isTauriRuntime.mockReturnValue(true);
  useModelStore.setState({
    state: "unknown",
    modelPath: null,
    progress: null,
    error: null,
  });
  useSettingsStore.setState((s) => ({
    settings: { ...s.settings, activeProvider: "local" },
  }));
});

describe("model store bootstrap", () => {
  it("激活本地模型且已下载未加载 → 自动加载进内存", async () => {
    checkInstalled.mockResolvedValue({ path: "/m.gguf", sizeBytes: 1 });
    getLoadStatus.mockResolvedValue({
      loaded: false,
      model_path: null,
      ctx_size: 0,
    });
    loadModel.mockResolvedValue({
      loaded: true,
      model_path: "/m.gguf",
      ctx_size: 16384,
    });

    await useModelStore.getState().bootstrap();

    expect(loadModel).toHaveBeenCalledWith("/m.gguf", 16384);
    expect(useModelStore.getState().state).toBe("loaded");
  });

  it("激活远程 provider → 不加载（不占内存）", async () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, activeProvider: "deepseek" },
    }));

    await useModelStore.getState().bootstrap();

    expect(loadModel).not.toHaveBeenCalled();
    expect(useModelStore.getState().state).toBe("unknown");
  });

  it("模型未下载 → 不触发下载也不加载", async () => {
    checkInstalled.mockResolvedValue(null);
    getLoadStatus.mockResolvedValue({
      loaded: false,
      model_path: null,
      ctx_size: 0,
    });

    await useModelStore.getState().bootstrap();

    expect(loadModel).not.toHaveBeenCalled();
    expect(useModelStore.getState().state).toBe("absent");
  });

  it("已在内存中 → 幂等，不重复加载", async () => {
    checkInstalled.mockResolvedValue({ path: "/m.gguf", sizeBytes: 1 });
    getLoadStatus.mockResolvedValue({
      loaded: true,
      model_path: "/m.gguf",
      ctx_size: 16384,
    });

    await useModelStore.getState().bootstrap();

    expect(loadModel).not.toHaveBeenCalled();
    expect(useModelStore.getState().state).toBe("loaded");
  });

  it("非 Tauri 运行时（浏览器预览）→ 直接跳过", async () => {
    isTauriRuntime.mockReturnValue(false);

    await useModelStore.getState().bootstrap();

    expect(loadModel).not.toHaveBeenCalled();
    expect(checkInstalled).not.toHaveBeenCalled();
  });
});
