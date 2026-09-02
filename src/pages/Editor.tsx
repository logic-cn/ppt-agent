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
import { useEffect, useState, useRef, useMemo } from "react";
import { useDeckStore } from "@/store/deck";
import { useJobStore, runJob } from "@/store/job";
import { SlidePreview } from "@/engine/preview";
import { OutlineEditor } from "@/components/outline";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { ImportDialog } from "@/components/import-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToastStore } from "@/store/toast";
import { deleteDeck } from "@/services/storage";
import { useCustomPalettes } from "@/store/custom-palettes";
import { DesignPanel } from "@/components/design";
import { useQualityStore } from "@/store/quality";
import { checkDeckQuality, hasHardError } from "@/services/quality";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PresentationMode } from "@/components/presentation-mode";
import { resolveTheme } from "@/themes";
import { exportDeck, exportDeckToBlob } from "@/engine/pptx";
import { generateImage } from "@/services/image";
import { DEFAULT_DESIGN } from "@/types/design";
import { useT } from "@/hooks/use-page-t";

export default function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const isNew = params.get("new") === "1";
  const deck = useDeckStore((s) => s.deck);
  const load = useDeckStore((s) => s.load);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(params.get("import") === "1");
  const [designOpen, setDesignOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [jobPanelOpen, setJobPanelOpen] = useState(false);
  const setDesign = useDeckStore((s) => s.setDesign);
  const setTitle = useDeckStore((s) => s.setTitle);
  const persist = useDeckStore((s) => s.persist);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const qualityReport = useQualityStore((s) => s.report);
  const pendingRules = useQualityStore((s) => s.pendingRules);
  // 导出前质量门：实时对当前 deck 跑 checkDeckQuality，存在 hard 即阻断导出。
  // 同时保留模板流程写入的 report 结果（含模板专属规则），两者取并集。
  const hasHard = useMemo(() => {
    if (!deck) return false;
    const liveHard = hasHardError(
      checkDeckQuality(deck, { rules: pendingRules ?? undefined }),
    );
    const reportHard = qualityReport ? hasHardError(qualityReport) : false;
    return liveHard || reportHard;
  }, [deck, pendingRules, qualityReport]);

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
    void useCustomPalettes.getState().load();
  }, []);

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
    // 切换/新建 deck 时先清空上一份质量报告，避免残留上一个 deck 的结果
    // （仅清 report，保留 pendingRules 供模板流程消费）
    useQualityStore.getState().setReport(null);
    if (isNew && deck) return;
    if (!id) return;
    load(id).then(() => {
      const current = useDeckStore.getState().deck;
      if (!current && !isNew) {
        addToast({
          type: "error",
          title: t("editor.projectNotFound"),
          message: t("editor.projectNotFoundMessage"),
        });
        const deckStore = useDeckStore.getState();
        void deckStore.createDeck().then((d) => {
          window.history.replaceState(null, "", `/editor/${d.id}?new=1`);
        });
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

    try {
      await runJob(
        {
          type: "image.generate",
          title: t("editor.generateImageJob", { title: slide.title }),
          canCancel: true,
        },
        async (job) => {
          const result = await generateImage(
            {
              prompt: [
                slide.title,
                ...(slide.bullets ?? []).map((b) => b.text),
              ].join("；"),
              size: "1024x1024",
            },
            deck.design ?? DEFAULT_DESIGN,
            job.signal,
          );
          useDeckStore.getState().updateSlide(slideId, {
            image: {
              type: "ai" as const,
              url: result.url,
              alt: result.revisedPrompt ?? slide.title,
            },
          });
        },
      );
    } catch (e) {
      addToast({
        type: "error",
        title: t("editor.imageGenerationFailed"),
        message: (e as Error).message,
      });
    }
  };

  const handleExport = async () => {
    if (!deck || deck.slides.length === 0) return;
    setExporting(true);

    // 有 SVG 过期的页：导出将包含旧版视觉，先给提示（不阻断）
    const staleCount = deck.slides.filter((s) => s.svg && s.svgStale).length;
    if (staleCount > 0) {
      addToast({
        type: "warning",
        title: t("editor.pagesStaleTitle"),
        message: t("editor.pagesStaleMessage", { n: staleCount }),
      });
    }

    try {
      const result = await runJob(
        {
          type: "pptx.export",
          title: t("editor.exportJob", { title: deck.title }),
          canCancel: true,
        },
        async (job) => {
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
            return "download" as const;
          }
          if (savePath) {
            await exportDeck(deck, savePath, job.signal);
            return "saved" as const;
          }
          return null;
        },
      );
      if (result === "download") {
        addToast({
          type: "success",
          title: t("editor.exportSuccess"),
          message: t("editor.exportDownloaded"),
        });
      } else if (result === "saved") {
        addToast({
          type: "success",
          title: t("editor.exportSuccess"),
          message: t("editor.exportSaved", { n: deck.slides.length }),
        });
      }
    } catch (e) {
      addToast({
        type: "error",
        title: t("editor.exportFailed"),
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
      <header className="flex items-center justify-between border-b border-border bg-bg-elevated px-4 h-10">
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
                setTitleInput(deck?.title ?? t("editor.untitled"));
                setEditingTitle(true);
              }}
              className="rounded px-1.5 py-0.5 text-sm font-medium text-text-primary hover:bg-bg-hover"
            >
              {deck?.title ?? t("editor.untitled")}
            </button>
          )}
          {deck && (
            <span className="text-xs text-text-muted">
              {t("editor.pageCount", { n: deck.slides.length })}
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
              {t("editor.activeJobsCount", { n: activeJobs.length })}
            </button>
          )}
          {failedJobs.length > 0 && !hasActiveJobs && (
            <button
              onClick={() => setJobPanelOpen(!jobPanelOpen)}
              className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/20"
            >
              {t("editor.failedJobsCount", { n: failedJobs.length })}
            </button>
          )}

          <button
            onClick={() => setLeftOpen((v) => !v)}
            className={`rounded-md p-1.5 hover:bg-bg-hover ${
              leftOpen ? "text-accent" : "text-text-secondary"
            }`}
            title={t("editor.outlinePanel")}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className={`rounded-md p-1.5 hover:bg-bg-hover ${
              rightOpen ? "text-accent" : "text-text-secondary"
            }`}
            title={t("editor.aiPanel")}
          >
            <PanelRight className="h-4 w-4" />
          </button>

          <div className="mx-2 h-5 w-px bg-border" />

          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-danger/10 hover:text-danger"
            title={t("editor.deleteProject")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="mx-2 h-5 w-px bg-border" />

          <div className="relative">
            <button
              onClick={() => setDesignOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-bg-hover ${
                designOpen
                  ? "text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title={t("editor.design")}
            >
              <Palette className="h-3.5 w-3.5" />
              {t("editor.design")}
            </button>
            {designOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDesignOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-border bg-bg-elevated p-3 shadow-lg">
                  <DesignPanel
                    design={deck?.design ?? DEFAULT_DESIGN}
                    onChange={(d) => setDesign(d)}
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <Upload className="h-3.5 w-3.5" />
            {t("editor.import")}
          </button>
          <button
            onClick={() => setPresenting(true)}
            disabled={!deck || deck.slides.length === 0}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30"
            title={t("editor.presentTooltip")}
          >
            <Monitor className="h-3.5 w-3.5" />
            {t("editor.present")}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !deck || deck.slides.length === 0 || hasHard}
            title={
              hasHard ? t("editor.qualityBlockExport") : t("common.exportPpt")
            }
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-purple-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 shadow-sm shadow-accent/20"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? t("common.exporting") : t("common.exportPpt")}
          </button>
          {hasHard && (
            <span
              className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-600"
              title={t("editor.qualityBlockExport")}
            >
              {t("editor.qualityNotMet")}
            </span>
          )}
        </div>
      </header>

      {/* 任务面板 */}
      {jobPanelOpen && (hasActiveJobs || failedJobs.length > 0) && (
        <div className="border-b border-border bg-bg-surface px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              {t("editor.taskList")}
            </span>
            <div className="flex items-center gap-2">
              {!hasActiveJobs && failedJobs.length > 0 && (
                <button
                  onClick={clearFinishedJobs}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  {t("editor.clearCompleted")}
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
                      ? t("editor.statusRunning")
                      : job.status === "failed"
                        ? t("editor.statusFailed")
                        : job.status === "succeeded"
                          ? t("editor.statusSucceeded")
                          : ""}
                  </span>
                  {job.status === "failed" && job.error && (
                    <button
                      onClick={() => navigator.clipboard.writeText(job.error!)}
                      className="rounded p-0.5 text-text-muted hover:text-text-primary"
                      title={t("editor.copyError")}
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
          <aside className="flex w-[280px] flex-col border-r border-border bg-bg-elevated">
            <OutlineEditor
              onSelectSlide={setSelectedIndex}
              selectedIndex={selectedIndex}
            />
          </aside>
        ) : (
          <aside className="flex w-9 flex-col items-center border-r border-border bg-bg-elevated py-2">
            <button
              onClick={() => setLeftOpen(true)}
              className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              title={t("editor.expandOutline")}
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
              {t("editor.previewPlaceholder")}
            </div>
          )}
        </main>

        {/* 右栏：属性检查器（AI / 页面 / 图表 / 配图 / 备注） */}
        {rightOpen && deck ? (
          <aside className="flex w-[280px] flex-col border-l border-border bg-bg-elevated">
            <InspectorPanel
              deck={deck}
              selectedIndex={selectedIndex}
              onGenerateImage={handleGenerateImage}
            />
          </aside>
        ) : (
          <aside className="flex w-9 flex-col items-center border-l border-border bg-bg-elevated py-2">
            <button
              onClick={() => setRightOpen(true)}
              className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              title={t("editor.expandAiPanel")}
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          </aside>
        )}
      </div>

      {presenting && deck && (
        <PresentationMode
          deck={deck}
          theme={resolveTheme(deck.design.palette, deck.design.visualStyle)}
          initialIndex={selectedIndex}
          onExit={() => setPresenting(false)}
        />
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmDialog
        open={deleteConfirm}
        title={t("editor.deleteProject")}
        message={t("editor.deleteConfirmMessage", {
          title: deck?.title ?? t("editor.untitled"),
        })}
        confirmText={t("common.delete")}
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
