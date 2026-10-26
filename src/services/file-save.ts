export interface SaveTextFileOptions {
  content: string;
  defaultName: string;
  extension: string;
  label: string;
  mimeType?: string;
}

export type SaveTextResult = "saved" | "downloaded" | null;

/** Tauri 环境走保存对话框；Web 环境回退为浏览器下载。取消返回 null。 */
export async function saveTextFile({
  content,
  defaultName,
  extension,
  label,
  mimeType = "application/json;charset=utf-8",
}: SaveTextFileOptions): Promise<SaveTextResult> {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      filters: [{ name: label, extensions: [extension] }],
      defaultPath: defaultName,
    });
    if (!path) return null;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_text_file", { path, content });
    return "saved";
  } catch {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = defaultName;
    anchor.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  }
}
