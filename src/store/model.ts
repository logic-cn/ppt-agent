import { create } from "zustand";
import {
  MODEL_REGISTRY,
  type ModelDef,
  type ModelTier,
  checkInstalled,
  deleteModel,
  downloadModel,
  getLoadStatus,
  isTauriRuntime,
  loadModel,
  unloadModel,
} from "@/services/model-manager";
import { useSettingsStore } from "@/store/settings";

export type ModelState =
  | "unknown" // 尚未探测
  | "unsupported" // 非桌面端（浏览器预览）
  | "absent" // 未下载
  | "downloading" // 下载中
  | "downloaded" // 已下载未加载
  | "loading" // 加载进内存中
  | "loaded" // 就绪
  | "error";

interface Progress {
  downloaded: number;
  total: number | null;
  phase: "downloading" | "verifying";
  sourceIndex: number;
}

interface ModelStore {
  state: ModelState;
  tier: ModelTier;
  modelPath: string | null;
  ctxSize: number;
  progress: Progress | null;
  error: string | null;
  refresh: () => Promise<void>;
  setTier: (tier: ModelTier) => Promise<void>;
  /** 下载并加载（幂等：已就绪直接返回）；供生成入口在发送前调用 */
  ensureReady: () => Promise<void>;
  download: () => Promise<void>;
  load: () => Promise<void>;
  unload: () => Promise<void>;
  remove: () => Promise<void>;
}

let busy: Promise<void> | null = null;

export const useModelStore = create<ModelStore>((set, get) => {
  const def = (): ModelDef => MODEL_REGISTRY[get().tier];

  const doDownload = async (): Promise<void> => {
    const d = def();
    set({
      state: "downloading",
      error: null,
      progress: {
        downloaded: 0,
        total: d.sizeBytes,
        phase: "downloading",
        sourceIndex: 0,
      },
    });
    const info = await downloadModel(d, (p) =>
      set({
        progress: {
          downloaded: p.downloaded,
          total: p.total,
          phase: p.phase === "verifying" ? "verifying" : "downloading",
          sourceIndex: p.source_index,
        },
      }),
    );
    set({ state: "downloaded", modelPath: info.path, progress: null });
  };

  const doLoad = async (): Promise<void> => {
    const d = def();
    const path =
      get().modelPath ??
      (await checkInstalled(d).then((i) => i?.path ?? null));
    if (!path) throw new Error("模型文件不存在，请先下载");
    set({ state: "loading", error: null });
    const st = await loadModel(path, d.ctxSize);
    set({
      state: "loaded",
      modelPath: st.model_path,
      ctxSize: st.ctx_size,
    });
  };

  return {
    state: "unknown",
    tier: useSettingsStore.getState().settings.localModelTier ?? "standard",
    modelPath: null,
    ctxSize: MODEL_REGISTRY.standard.ctxSize,
    progress: null,
    error: null,

    refresh: async () => {
      if (!isTauriRuntime()) {
        set({ state: "unsupported" });
        return;
      }
      try {
        const [installed, loadStatus] = await Promise.all([
          checkInstalled(def()),
          getLoadStatus(),
        ]);
        if (loadStatus.loaded) {
          set({
            state: "loaded",
            modelPath: loadStatus.model_path,
            ctxSize: loadStatus.ctx_size,
          });
        } else if (installed) {
          set({ state: "downloaded", modelPath: installed.path });
        } else {
          set({ state: "absent", modelPath: null });
        }
      } catch (e) {
        set({ state: "error", error: String(e) });
      }
    },

    setTier: async (tier) => {
      const s = get();
      // 切换档位：卸载旧模型并重置为未下载态
      if (s.state === "loaded") await unloadModel().catch(() => {});
      set({ tier, state: "absent", modelPath: null, progress: null, error: null });
      useSettingsStore.setState((st) => ({
        settings: { ...st.settings, localModelTier: tier },
      }));
      await get().refresh();
    },

    ensureReady: async () => {
      // 并发去重：多个入口同时触发只跑一次
      if (busy) return busy;
      const run = (async () => {
        try {
          await get().refresh();
          const { state } = get();
          if (state === "loaded") return;
          if (state === "absent" || state === "error") await doDownload();
          if (get().state === "downloaded") await doLoad();
        } catch (e) {
          set({
            state: "error",
            error: e instanceof Error ? e.message : String(e),
            progress: null,
          });
          throw e;
        }
      })();
      busy = run.finally(() => {
        busy = null;
      });
      return busy;
    },

    download: async () => {
      try {
        await doDownload();
      } catch (e) {
        set({
          state: "error",
          error: e instanceof Error ? e.message : String(e),
          progress: null,
        });
      }
    },

    load: async () => {
      try {
        await doLoad();
      } catch (e) {
        set({ state: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },

    unload: async () => {
      await unloadModel();
      const installed = await checkInstalled(def());
      set({
        state: installed ? "downloaded" : "absent",
        modelPath: installed?.path ?? null,
      });
    },

    remove: async () => {
      if (get().state === "loaded") await unloadModel().catch(() => {});
      await deleteModel(def());
      set({ state: "absent", modelPath: null, progress: null, error: null });
    },
  };
});
