import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateCheckOutcome =
  | { status: "unsupported" }
  | { status: "error"; message: string }
  | { status: "up-to-date" }
  | { status: "available"; version: string; notes: string; update: Update };

export type InstallOutcome =
  | { status: "success" }
  | { status: "error"; message: string };

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function checkForUpdate(): Promise<UpdateCheckOutcome> {
  if (!isTauriRuntime()) return { status: "unsupported" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { status: "up-to-date" };
    return {
      status: "available",
      version: update.version,
      notes: update.body ?? String(update.date ?? ""),
      update,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function installUpdate(
  update: Update,
  onProgress?: (percent: number) => void,
): Promise<InstallOutcome> {
  try {
    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
        downloaded = 0;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total > 0 && onProgress) {
          onProgress(Math.min(99, Math.round((downloaded / total) * 100)));
        }
      }
    });
    return { status: "success" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function getAppVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}
