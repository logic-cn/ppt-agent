export interface SaveTextFileOptions {
  content: string;
  defaultName: string;
  extension: string;
  label: string;
  mimeType?: string;
}

export type SaveTextResult = "saved" | "downloaded" | null;

function downloadInBrowser(
  content: string,
  defaultName: string,
  mimeType: string,
): "downloaded" {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

/**
 * Tauri 环境走保存对话框 + 写盘；非桌面运行时（模块缺失或对话框不可用）
 * 回退为浏览器下载。用户取消返回 null。
 * 写盘失败必须抛给调用方——不能伪装成一次成功的下载。
 */
export async function saveTextFile({
  content,
  defaultName,
  extension,
  label,
  mimeType = "application/json;charset=utf-8",
}: SaveTextFileOptions): Promise<SaveTextResult> {
  const dialog = await import("@tauri-apps/plugin-dialog").catch(() => null);
  if (!dialog) return downloadInBrowser(content, defaultName, mimeType);

  let path: string | null;
  try {
    path = await dialog.save({
      filters: [{ name: label, extensions: [extension] }],
      defaultPath: defaultName,
    });
  } catch {
    return downloadInBrowser(content, defaultName, mimeType);
  }
  if (!path) return null;

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_text_file", { path, content });
  return "saved";
}
