import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Link, FileText, Loader2, X } from "lucide-react";
import { importDocx, importMarkdown, importUrl } from "@/services/importer";
import { useDeckStore } from "@/store/deck";
import { useToastStore } from "@/store/toast";
import { generateOutline } from "@/services/outline";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportDialog({ open, onClose }: Props) {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { deck, replaceSlides } = useDeckStore();
  const addToast = useToastStore((s) => s.add);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      let text: string;
      let title: string;

      if (file.name.endsWith(".docx")) {
        const result = await importDocx(file);
        text = result.text;
        title = result.title;
      } else if (file.name.endsWith(".md")) {
        const result = await importMarkdown(file);
        text = result.text;
        title = result.title;
      } else {
        addToast({
          type: "error",
          title: "不支持的文件格式",
          message: "仅支持 .docx 和 .md 文件",
        });
        setImporting(false);
        return;
      }

      addToast({
        type: "info",
        title: "文档解析完成",
        message: "正在生成大纲…",
      });

      const slides = await generateOutline({
        topic: title,
        docContent: text,
      });

      if (deck) {
        replaceSlides(slides);
      }
      addToast({ type: "success", title: `已生成 ${slides.length} 页大纲` });
      onClose();
    } catch (e) {
      addToast({
        type: "error",
        title: "导入失败",
        message: (e as Error).message,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleUrl = async () => {
    const u = url.trim();
    if (!u) return;

    setImporting(true);
    try {
      const result = await importUrl(u);

      addToast({
        type: "info",
        title: "网页解析完成",
        message: "正在生成大纲…",
      });

      const slides = await generateOutline({
        topic: result.title,
        docContent: result.text,
      });

      if (deck) {
        replaceSlides(slides);
      }
      addToast({ type: "success", title: `已生成 ${slides.length} 页大纲` });
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        addToast({
          type: "warning",
          title: "无法访问该网页",
          message:
            "可能是 CORS 限制或网络问题。试试手动复制内容粘贴到 Markdown 文件导入。",
        });
      } else {
        addToast({ type: "error", title: "导入失败", message: msg });
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="import-dialog-title" className="text-base font-semibold">
            导入文档
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("file")}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm ${
              tab === "file"
                ? "border-b-2 border-accent text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Upload className="h-4 w-4" />
            上传文件
          </button>
          <button
            onClick={() => setTab("url")}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm ${
              tab === "url"
                ? "border-b-2 border-accent text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Link className="h-4 w-4" />
            网页链接
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5">
          {tab === "file" ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border px-6 py-12 text-center transition hover:border-accent hover:bg-accent-soft/10"
            >
              <FileText className="h-10 w-10 text-text-muted" />
              <div>
                <p className="font-medium text-text-primary">点击上传文件</p>
                <p className="mt-1 text-sm text-text-muted">
                  支持 .docx（Word 文档）和 .md（Markdown）格式
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.md"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm text-text-secondary">
                  网页链接
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full rounded-lg border border-border bg-bg-base px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <p className="text-xs text-text-muted">
                注意：部分网站可能会阻止访问（CORS
                限制），建议优先使用文件导入。
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
          >
            取消
          </button>
          {tab === "url" && (
            <button
              onClick={handleUrl}
              disabled={importing || !url.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              导入并生成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
