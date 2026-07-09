import { useParams, useSearchParams } from "react-router-dom";
import {
  PanelLeft,
  PanelRight,
  Download,
  ChevronLeft,
  Upload,
  Palette,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDeckStore } from "@/store/deck";
import { SlidePreview } from "@/engine/preview";
import { OutlineEditor } from "@/components/outline";
import { exportDeck, exportDeckToBlob } from "@/engine/pptx";
import { ChatPanel } from "@/components/chat";
import { ImportDialog } from "@/components/import-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToastStore } from "@/store/toast";
import { BUILTIN_THEMES } from "@/themes";

export default function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get("new") === "1";
  const { deck, load } = useDeckStore();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(params.get("import") === "1");
  const [themeOpen, setThemeOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const setTheme = useDeckStore((s) => s.setTheme);

  useEffect(() => {
    if (isNew && deck) return;
    if (!id) return;
    load(id).then(() => {
      const current = useDeckStore.getState().deck;
      if (!current && !isNew) {
        addToast({
          type: "error",
          title: "项目不存在",
          message: "尝试加载的项目不存在，将新建一个项目。",
        });
        const deckStore = useDeckStore.getState();
        void deckStore.createDeck().then((d) => {
          window.history.replaceState(null, "", `/editor/${d.id}?new=1`);
        });
      }
    });
  }, [id, isNew, load, deck]);

  useKeyboardShortcuts();

  const addToast = useToastStore((s) => s.add);
  const handleExport = async () => {
    if (!deck || deck.slides.length === 0) return;
    setExporting(true);
    try {
      let savePath: string | null = null;
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        savePath = await save({
          filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
          defaultPath: `${deck.title}.pptx`,
        });
      } catch {
        // 非 Tauri 环境：下载到浏览器
        const blob = await exportDeckToBlob(deck);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${deck.title}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
        addToast({
          type: "success",
          title: "导出成功",
          message: "文件已下载到本地",
        });
        return;
      }
      if (savePath) {
        await exportDeck(deck, savePath);
        addToast({
          type: "success",
          title: "导出成功",
          message: `${deck.slides.length} 页已保存`,
        });
      }
    } catch (e) {
      addToast({
        type: "error",
        title: "导出失败",
        message: (e as Error).message,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between border-b border-border bg-bg-surface px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {deck?.title ?? "未命名项目"}
          </span>
          {deck && (
            <span className="text-xs text-text-muted">
              {deck.slides.length} 页
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setLeftOpen((v) => !v)}
            className={`rounded-md p-1.5 hover:bg-bg-hover ${
              leftOpen ? "text-accent" : "text-text-secondary"
            }`}
            title="大纲面板"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className={`rounded-md p-1.5 hover:bg-bg-hover ${
              rightOpen ? "text-accent" : "text-text-secondary"
            }`}
            title="AI 面板"
          >
            <PanelRight className="h-4 w-4" />
          </button>

          <div className="mx-2 h-5 w-px bg-border" />

          <div className="relative">
            <button
              onClick={() => setThemeOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              title="切换主题"
            >
              <Palette className="h-3.5 w-3.5" />
              主题
            </button>
            {themeOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setThemeOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-bg-surface p-1 shadow-lg">
                  {BUILTIN_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setThemeOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-bg-hover ${
                        deck?.themeId === t.id
                          ? "text-accent"
                          : "text-text-secondary"
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ background: t.colors.primary }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <Upload className="h-3.5 w-3.5" />
            导入
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !deck || deck.slides.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "导出中…" : "导出 PPT"}
          </button>
        </div>
      </header>

      {/* 三栏工作区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左栏：大纲编辑器 */}
        {leftOpen && (
          <aside className="flex w-96 flex-col border-r border-border bg-bg-surface">
            <OutlineEditor onSelectSlide={setSelectedIndex} />
          </aside>
        )}

        {/* 中栏：预览 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {deck && deck.slides.length > 0 ? (
            <SlidePreview
              deck={deck}
              currentIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-text-muted">
              生成大纲后将在此预览
            </div>
          )}
        </main>

        {/* 右栏：AI 对话 */}
        {rightOpen && (
          <aside className="flex w-80 flex-col border-l border-border bg-bg-surface">
            <ChatPanel />
          </aside>
        )}
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
