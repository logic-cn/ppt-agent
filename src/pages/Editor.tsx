import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  PanelLeft,
  PanelRight,
  Download,
  ChevronLeft,
  Upload,
  Palette,
  Trash2,
  Check,
  Monitor,
  X,
  Copy,
  Loader2,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useDeckStore } from "@/store/deck";
import { useJobStore } from "@/store/job";
import { SlidePreview } from "@/engine/preview";
import { OutlineEditor } from "@/components/outline";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { ImportDialog } from "@/components/import-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToastStore } from "@/store/toast";
import { BUILTIN_THEMES } from "@/themes";
import { useCustomThemeStore } from "@/store/custom-themes";
import { deleteDeck } from "@/services/storage";
import { useQualityStore } from "@/store/quality";
import { checkDeckQuality } from "@/services/quality";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PresentationMode } from "@/components/presentation-mode";
import { resolveTheme } from "@/themes";
import { exportDeck, exportDeckToBlob } from "@/engine/pptx";
import { generateImage } from "@/services/image";

export default function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isNew = params.get("new") === "1";
  const deck = useDeckStore((s) => s.deck);
  const load = useDeckStore((s) => s.load);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(params.get("import") === "1");
  const [themeOpen, setThemeOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [jobPanelOpen, setJobPanelOpen] = useState(false);
  const setTheme = useDeckStore((s) => s.setTheme);
  const setTitle = useDeckStore((s) => s.setTitle);
  const persist = useDeckStore((s) => s.persist);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const customThemes = useCustomThemeStore((s) => s.themes);
  const loadCustomThemes = useCustomThemeStore((s) => s.load);

  const jobs = useJobStore((s) => s.jobs);
  const activeJobIds = useJobStore((s) => s.activeJobIds);
  const clearFinishedJobs = useJobStore((s) => s.clearFinishedJobs);
  const activeJobs = jobs.filter((j) => activeJobIds.includes(j.id));
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const hasActiveJobs = activeJobs.length > 0;

  useEffect(() => {
    if (editingTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [editingTitle]);

  // 幻灯片数量变化时收敛 selectedIndex，避免删除末页后越界导致画布/检查器空白
  useEffect(() => {
    if (!deck) return;
    const max = deck.slides.length - 1;
    setSelectedIndex((i) => (deck.slides.length === 0 ? 0 : Math.min(i, max)));
  }, [deck?.slides.length]);

  const commitTitle = async () => {
    const v = titleInput.trim();
    if (v && deck) {
      setTitle(v);
      await persist();
    }
    setEditingTitle(false);
  };

  useEffect(() => {
    void loadCustomThemes();
  }, [loadCustomThemes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = useDeckStore.getState().deck;
      if (e.key === "F5" && d && d.slides.length > 0) {
        e.preventDefault();
        setPresenting(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isNew && deck) return;
    if (!id) return;
    const from = params.get("from");
    const shouldCheckQuality = from === "template" || from === "template-ai";
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
      } else if (shouldCheckQuality) {
        const qualityStore = useQualityStore.getState();
        const rules = qualityStore.pendingRules ?? undefined;
        qualityStore.clearPendingRules();
        qualityStore.setReport(
          current ? checkDeckQuality(current, { rules }) : null,
        );
      }
    });
  }, [id, isNew, load, params]);

  useKeyboardShortcuts();

  // 自动展开任务面板
  useEffect(() => {
    if (hasActiveJobs) setJobPanelOpen(true);
  }, [hasActiveJobs]);

  const addToast = useToastStore((s) => s.add);

  const handleGenerateImage = async (slideId: string) => {
    if (!deck) return;
    const slide = deck.slides.find((s) => s.id === slideId);
    if (!slide) return;
    const prompt = `为演示文稿幻灯片生成配图。标题：${slide.title}${slide.bullets ? "。要点：" + slide.bullets.map((b) => b.text).join("、") : ""}${slide.body ? "。正文：" + slide.body.slice(0, 100) : ""}`;

    const jobStore = useJobStore.getState();
    const job = jobStore.startJob({
      type: "image.generate",
      title: `生成配图「${slide.title}」`,
      canCancel: true,
    });

    try {
      const result = await generateImage(
        { prompt, size: "1024x1024" },
        job.signal,
      );
      job.succeed("配图生成完成");
      useDeckStore.getState().updateSlide(slideId, {
        image: {
          type: "ai" as const,
          url: result.url,
          alt: result.revisedPrompt ?? slide.title,
        },
      });
    } catch (e) {
      if (job.signal.aborted) job.cancel();
      else job.fail(e);
      addToast({
        type: "error",
        title: "配图生成失败",
        message: (e as Error).message,
      });
    }
  };

  const handleExport = async () => {
    if (!deck || deck.slides.length === 0) return;
    setExporting(true);

    const jobStore = useJobStore.getState();
    const job = jobStore.startJob({
      type: "pptx.export",
      title: `导出「${deck.title}」`,
      canCancel: true,
    });

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
        const blob = await exportDeckToBlob(deck, job.signal);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${deck.title}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
        if (job.signal.aborted) {
          job.cancel();
          return;
        }
        job.succeed("导出完成");
        addToast({
          type: "success",
          title: "导出成功",
          message: "文件已下载到本地",
        });
        return;
      }
      if (savePath) {
        await exportDeck(deck, savePath, job.signal);
        if (job.signal.aborted) {
          job.cancel();
          return;
        }
        job.succeed("导出完成");
        addToast({
          type: "success",
          title: "导出成功",
          message: `${deck.slides.length} 页已保存`,
        });
      }
    } catch (e) {
      if (job.signal.aborted) job.cancel();
      else job.fail(e);
      addToast({
        type: "error",
        title: "导出失败",
        message: (e as Error).message,
      });
    } finally {
      setExporting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-blue-500";
      case "succeeded":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "cancelled":
        return "text-text-muted";
      default:
        return "text-text-muted";
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between border-b border-border bg-white px-4 h-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="rounded border border-accent bg-bg-base px-1.5 py-0.5 text-sm font-medium text-text-primary outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setTitleInput(deck?.title ?? "未命名项目");
                setEditingTitle(true);
              }}
              className="rounded px-1.5 py-0.5 text-sm font-medium text-text-primary hover:bg-bg-hover"
            >
              {deck?.title ?? "未命名项目"}
            </button>
          )}
          {deck && (
            <span className="text-xs text-text-muted">
              {deck.slides.length} 页
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 任务状态指示器 */}
          {hasActiveJobs && (
            <button
              onClick={() => setJobPanelOpen(!jobPanelOpen)}
              className="flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-500/20"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {activeJobs.length} 个任务
            </button>
          )}
          {failedJobs.length > 0 && !hasActiveJobs && (
            <button
              onClick={() => setJobPanelOpen(!jobPanelOpen)}
              className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/20"
            >
              {failedJobs.length} 个失败任务
            </button>
          )}

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

          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-danger/10 hover:text-danger"
            title="删除项目"
          >
            <Trash2 className="h-3.5 w-3.5" />
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
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-white p-1 shadow-lg">
                  {BUILTIN_THEMES.map((t) => {
                    const swatch =
                      t.id === "minimal-white"
                        ? "#e5e7eb"
                        : t.id === "vibrant-orange"
                          ? t.colors.secondary
                          : t.colors.primary;
                    return (
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
                          className="h-4 w-4 shrink-0 rounded-full border border-border"
                          style={{ background: swatch }}
                        />
                        <span className="flex-1 text-left">{t.name}</span>
                        {deck?.themeId === t.id && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                        )}
                      </button>
                    );
                  })}

                  {customThemes.length > 0 && (
                    <>
                      <div className="mx-2 my-1 border-t border-border" />
                      {customThemes.map((t) => (
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
                            className="h-4 w-4 shrink-0 rounded-full border border-border"
                            style={{ background: t.colors.primary }}
                          />
                          <span className="flex-1 text-left">{t.name}</span>
                          {deck?.themeId === t.id && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  <div className="mx-2 my-1 border-t border-border" />
                  <button
                    onClick={() => {
                      setThemeOpen(false);
                      navigate("/settings");
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-text-muted transition-colors hover:bg-bg-hover"
                  >
                    <Palette className="h-3 w-3" />
                    管理自定义主题
                  </button>
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
            onClick={() => setPresenting(true)}
            disabled={!deck || deck.slides.length === 0}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30"
            title="演示 (F5)"
          >
            <Monitor className="h-3.5 w-3.5" />
            演示
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !deck || deck.slides.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-purple-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 shadow-sm shadow-accent/20"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "导出中…" : "导出 PPT"}
          </button>
        </div>
      </header>

      {/* 任务面板 */}
      {jobPanelOpen && (hasActiveJobs || failedJobs.length > 0) && (
        <div className="border-b border-border bg-bg-surface px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              任务列表
            </span>
            <div className="flex items-center gap-2">
              {!hasActiveJobs && failedJobs.length > 0 && (
                <button
                  onClick={clearFinishedJobs}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  清除已完成
                </button>
              )}
              <button
                onClick={() => setJobPanelOpen(false)}
                className="rounded p-0.5 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-1 space-y-1">
            {jobs
              .filter(
                (j) => activeJobIds.includes(j.id) || j.status === "failed",
              )
              .map((job) => (
                <div key={job.id} className="flex items-center gap-2 text-xs">
                  {job.status === "running" && (
                    <Loader2
                      className={`h-3 w-3 animate-spin ${statusColor(job.status)}`}
                    />
                  )}
                  {job.status === "failed" && (
                    <X className="h-3 w-3 text-red-500" />
                  )}
                  {job.status === "succeeded" && (
                    <Check className="h-3 w-3 text-green-500" />
                  )}
                  <span className="text-text-primary">{job.title}</span>
                  {job.message && (
                    <span className="text-text-muted">— {job.message}</span>
                  )}
                  {job.progress !== undefined && job.progress < 1 && (
                    <span className="text-text-muted">
                      {Math.round(job.progress * 100)}%
                    </span>
                  )}
                  <span className={`ml-auto ${statusColor(job.status)}`}>
                    {job.status === "running"
                      ? "进行中"
                      : job.status === "failed"
                        ? "失败"
                        : job.status === "succeeded"
                          ? "完成"
                          : ""}
                  </span>
                  {job.status === "failed" && job.error && (
                    <button
                      onClick={() => navigator.clipboard.writeText(job.error!)}
                      className="rounded p-0.5 text-text-muted hover:text-text-primary"
                      title="复制错误"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 三栏工作区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左栏：大纲编辑器 */}
        {leftOpen ? (
          <aside className="flex w-[280px] flex-col border-r border-border bg-white">
            <OutlineEditor
              onSelectSlide={setSelectedIndex}
              selectedIndex={selectedIndex}
            />
          </aside>
        ) : (
          <aside className="flex w-9 flex-col items-center border-r border-border bg-white py-2">
            <button
              onClick={() => setLeftOpen(true)}
              className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              title="展开大纲"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          </aside>
        )}

        {/* 中栏：预览 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {deck && deck.slides.length > 0 ? (
            <SlidePreview
              deck={deck}
              currentIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
              onGenerateImage={handleGenerateImage}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-text-muted">
              生成大纲后将在此预览
            </div>
          )}
        </main>

        {/* 右栏：属性检查器（AI / 页面 / 图表 / 配图 / 备注） */}
        {rightOpen && deck ? (
          <aside className="flex w-[280px] flex-col border-l border-border bg-white">
            <InspectorPanel
              deck={deck}
              selectedIndex={selectedIndex}
              onGenerateImage={handleGenerateImage}
            />
          </aside>
        ) : (
          <aside className="flex w-9 flex-col items-center border-l border-border bg-white py-2">
            <button
              onClick={() => setRightOpen(true)}
              className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              title="展开 AI 面板"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          </aside>
        )}
      </div>

      {presenting && deck && (
        <PresentationMode
          deck={deck}
          theme={resolveTheme(deck.themeId, deck.themeOverrides)}
          initialIndex={selectedIndex}
          onExit={() => setPresenting(false)}
        />
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmDialog
        open={deleteConfirm}
        title="删除项目"
        message={`确定要删除「${deck?.title ?? "未命名项目"}」吗？此操作不可撤销。`}
        confirmText="删除"
        onConfirm={async () => {
          if (deck) {
            await deleteDeck(deck.id);
            navigate("/");
          }
        }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
