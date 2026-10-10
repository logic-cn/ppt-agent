import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** 档位：standard=2B（推荐），light=1B（低配机器极速档） */
export type ModelTier = "standard" | "light";

export interface ModelDef {
  tier: ModelTier;
  fileName: string;
  displayName: string;
  sizeBytes: number;
  sha256: string;
  /** 按顺序故障切换的下载源 */
  urls: string[];
  /** 建议的最小物理内存（GB） */
  minMemGB: number;
  /** 加载时默认上下文长度 */
  ctxSize: number;
}

const ggufUrls = (repo: string, file: string) => [
  `https://modelscope.cn/models/OpenBMB/${repo}/resolve/master/${file}`,
  `https://hf-mirror.com/OpenBMB/${repo}/resolve/main/${file}`,
];

export const MODEL_REGISTRY: Record<ModelTier, ModelDef> = {
  standard: {
    tier: "standard",
    fileName: "MiniCPM5-2B-Q4_K_M.gguf",
    displayName: "MiniCPM5-2B (Q4_K_M)",
    sizeBytes: 1_561_318_368,
    sha256: "ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd",
    urls: ggufUrls("MiniCPM5-2B-GGUF", "MiniCPM5-2B-Q4_K_M.gguf"),
    minMemGB: 8,
    ctxSize: 16384,
  },
  light: {
    tier: "light",
    fileName: "MiniCPM5-1B-Q4_K_M.gguf",
    displayName: "MiniCPM5-1B (Q4_K_M)",
    sizeBytes: 688_065_920,
    sha256: "81b64d05a23b17b34c475f42b3e72fbde62d4b92cc34541f7a8031d0752deafa",
    urls: ggufUrls("MiniCPM5-1B-GGUF", "MiniCPM5-1B-Q4_K_M.gguf"),
    minMemGB: 4,
    ctxSize: 8192,
  },
};

export interface DownloadProgressEvent {
  file_name: string;
  source_index: number;
  downloaded: number;
  total: number | null;
  phase: string;
}

interface InstalledInfo {
  path: string;
  size_bytes: number;
}

interface LoadStatusDto {
  loaded: boolean;
  model_path: string | null;
  ctx_size: number;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function checkInstalled(
  def: ModelDef,
): Promise<InstalledInfo | null> {
  if (!isTauriRuntime()) return null;
  return invoke<InstalledInfo | null>("model_installed", {
    fileName: def.fileName,
  });
}

export async function downloadModel(
  def: ModelDef,
  onProgress: (p: DownloadProgressEvent) => void,
): Promise<InstalledInfo & { source_index: number }> {
  let unlisten: UnlistenFn | null = null;
  try {
    unlisten = await listen<DownloadProgressEvent>(
      "model-download-progress",
      (e) => {
        if (e.payload.file_name === def.fileName) onProgress(e.payload);
      },
    );
    const res = await invoke<{
      path: string;
      size_bytes: number;
      source_index: number;
    }>("model_download", {
      opts: {
        urls: def.urls,
        file_name: def.fileName,
        sha256: def.sha256,
      },
    });
    return res;
  } finally {
    unlisten?.();
  }
}

export async function deleteModel(def: ModelDef): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("model_delete", { fileName: def.fileName });
}

export async function loadModel(
  modelPath: string,
  ctxSize: number,
): Promise<LoadStatusDto> {
  return invoke<LoadStatusDto>("local_llm_load", {
    modelPath,
    ctxSize,
  });
}

export async function unloadModel(): Promise<LoadStatusDto> {
  return invoke<LoadStatusDto>("local_llm_unload");
}

export async function getLoadStatus(): Promise<LoadStatusDto> {
  return invoke<LoadStatusDto>("local_llm_status");
}

export function formatGB(bytes: number): string {
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}
