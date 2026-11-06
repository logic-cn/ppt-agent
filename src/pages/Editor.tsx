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
  RefreshCw,
  FileJson,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useDeckStore } from "@/store/deck";
import { useGenerationFollowStore } from "@/store/generation-follow";
import { useSettingsStore } from "@/store/settings";
import { useModelStore } from "@/store/model";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { isLocalProviderConfig } from "@/types/llm";
import { MODEL_REGISTRY } from "@/services/model-manager";
import { generateSlideSvg } from "@/engine/svg/executor";
import { buildSpecLock } from "@/design/spec-lock";
import type { ElementContext } from "@/engine/preview/svg-editor-canvas";
import { useJobStore, runJob } from "@/store/job";
import { SlidePreview } from "@/engine/preview";
import { OutlineEditor } from "@/components/outline";
import {
  InspectorPanel,
  type InspectorTab,
} from "@/components/inspector/inspector-panel";
import { ImportDialog } from "@/components/import-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToastStore } from "@/store/toast";
import { deleteDeck } from "@/services/storage";
import { serializeDeckJson } from "@/services/project-backup";
import { saveTextFile } from "@/services/file-save";
import { useCustomPalettes } from "@/store/custom-palettes";
import { DesignPanel } from "@/components/design";
import { useQualityStore } from "@/store/quality";
import { checkDeckQuality, hasHardError } from "@/services/quality";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PresentationMode } from "@/components/presentation-mode";
import { resolveTheme } from "@/themes";
import type { Deck } from "@/types/deck";
import {
  exportDeck,
  exportDeckToBlob,
  type ExportEffectsOptions,
} from "@/engine/pptx";
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
  // 三栏宽度可拖拽调宽（220–420px），记忆到 localStorage
  const [leftWidth, setLeftWidth] = useState(() =>
    readPanelWidth("editor.leftWidth"),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    readPanelWidth("editor.rightWidth"),
  );
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  leftWidthRef.current = leftWidth;
  rightWidthRef.current = rightWidth;
  const [exporting, setExporting] = useState(false);
  const [syncingStale, setSyncingStale] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const generatingIndex = useGenerationFollowStore((s) => s.generatingIndex);
  const [importOpen, setImportOpen] = useState(params.get("import") === "1");
  const [designOpen, setDesignOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // 检查器 tab 受控于编辑器：质量门禁 chip 可一键跳到 AI tab 查看报告
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("ai");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [jobPanelOpen, setJobPanelOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  // 记录设计面板触发按钮：Escape/关闭按钮退出时归还焦点
  const designTriggerRef = useRef<HTMLButtonElement>(null);
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

  // 设计面板与溢出菜单：Escape 关闭，并把焦点归还给触发按钮
  useEffect(() => {
    if (!designOpen && !overflowOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (designOpen) {
        setDesignOpen(false);
        designTriggerRef.current?.focus();
      }
      if (overflowOpen) setOverflowOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [designOpen, overflowOpen]);

  const staleSlides = useMemo(
    () => deck?.slides.filter((s) => s.svg && s.svgStale) ?? [],
    [deck],
  );

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
    load(id)
      .then(() => {
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
      })
      .catch((e) => {
        addToast({
          type: "error",
          title: t("editor.projectNotFound"),
          message: (e as Error).message,
        });
      });
  }, [id, isNew, load, params]);

  useKeyboardShortcuts();

  // 自动展开任务面板
  useEffect(() => {
    if (hasActiveJobs) setJobPanelOpen(true);
  }, [hasActiveJobs]);

  const addToast = useToastStore((s) => s.add);

  // E1.5 批注流：选中元素 + 一句话 → baseSvg+instruction 定向重画（只动该元素相关的部分）
  const handleAnnotateElement = async (
    slideId: string,
    instruction: string,
    ctx: ElementContext,
  ) => {
    const deck = useDeckStore.getState().deck;
    const slide = deck?.slides.find((sl) => sl.id === slideId);
    if (!deck || !slide?.svg || annotating) return;
    setAnnotating(true);
    try {
      await runJob(
        { type: "deck.patch", title: t("editor.annotating"), canCancel: true },
        async (job) => {
          const svg = await generateSlideSvg({
            specLock: buildSpecLock(deck.design),
            plan: {
              role: "content",
              title: slide.title,
              intent: slide.title,
              bullets: (slide.bullets ?? []).map((b) => b.text),
            },
            pageIndex: deck.slides.indexOf(slide),
            totalPages: deck.slides.length,
            baseSvg: slide.svg,
            instruction: `仅修改以下指定元素，页面其余部分保持原样不变。\n目标元素（${ctx.tag}${ctx.bbox ? `，位于 (${Math.round(ctx.bbox.x)},${Math.round(ctx.bbox.y)})，尺寸 ${Math.round(ctx.bbox.w)}×${Math.round(ctx.bbox.h)}` : ""}）：${ctx.markup}\n修改要求：${instruction}`,
            signal: job.signal,
          });
          useDeckStore.getState().updateSlide(slideId, {
            svg,
            svgStale: false,
          });
        },
      );
      addToast({
        type: "success",
        title: t("editor.annotateApplied"),
        message: instruction.slice(0, 80),
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        addToast({
          type: "error",
          title: t("editor.annotateFailed"),
          message: (e as Error).message,
        });
      }
    } finally {
      setAnnotating(false);
    }
  };

  // D1：导出效果组装——转场/入场动画取 deck 放映偏好
  const buildExportEffects = async (
    currentDeck: Deck,
  ): Promise<ExportEffectsOptions> => {
    return {
      transition:
        currentDeck.transition && currentDeck.transition !== "none"
          ? currentDeck.transition
          : undefined,
      entranceAnimation: currentDeck.entranceAnimation,
    };
  };

  const handleSyncStale = async () => {
    if (syncingStale || exporting) return;
    const current = useDeckStore.getState().deck;
    if (!current) return;
    const stale = current.slides.filter((s) => s.svg && s.svgStale);
    if (stale.length === 0) return;

    setSyncingStale(true);
    try {
      await runJob(
        {
          type: "content.generate_batch",
          title: t("editor.syncStaleJob"),
          canCancel: true,
        },
        async (job) => {
          const failed: string[] = [];
          for (let i = 0; i < stale.length; i++) {
            if (job.signal.aborted) {
              throw new DOMException("已取消", "AbortError");
            }
            job.update({
              progress: i / stale.length,
              message: t("editor.syncStaleProgress", {
                current: i + 1,
                total: stale.length,
              }),
            });
            try {
              await useDeckStore
                .getState()
                .regenerateSlide(stale[i].id, job.signal);
            } catch (e) {
              // 单页失败不中断整批：其余页继续同步，最后汇总反馈
              if (job.signal.aborted) throw e;
              failed.push(stale[i].title || stale[i].id);
            }
          }
          job.update({
            progress: 1,
            message: t("editor.syncStaleProgress", {
              current: stale.length,
              total: stale.length,
            }),
          });
          if (failed.length > 0) {
            throw new Error(
              t("editor.syncStalePartial", {
                ok: stale.length - failed.length,
                fail: failed.length,
              }),
            );
          }
        },
      );
      addToast({
        type: "success",
        title: t("editor.syncStaleDone"),
        message: t("editor.syncStaleDoneMessage", { n: stale.length }),
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        addToast({
          type: "error",
          title: t("editor.syncStaleFailed"),
          message: (e as Error).message,
        });
      }
    } finally {
      setSyncingStale(false);
    }
  };

  const handleExportProject = async () => {
    const current = useDeckStore.getState().deck;
    if (!current) return;
    try {
      const result = await saveTextFile({
        content: serializeDeckJson(current),
        defaultName: `${current.title}.json`,
        extension: "json",
        label: t("home.projectJsonLabel"),
      });
      if (result) {
        addToast({
          type: "success",
          title: t("editor.exportSuccess"),
          message: t("home.exportProjectSuccessMessage", {
            title: current.title,
          }),
        });
      }
    } catch (e) {
      addToast({
        type: "error",
        title: t("editor.exportFailed"),
        message: (e as Error).message,
      });
    }
  };

  const handleExport = async () => {
    if (!deck || deck.slides.length === 0) return;
    setExporting(true);

    // 有 SVG 过期的页：导出将包含旧版视觉，先给提示（不阻断）
    if (staleSlides.length > 0) {
      addToast({
        type: "warning",
        title: t("editor.pagesStaleTitle"),
        message: t("editor.pagesStaleMessage", { n: staleSlides.length }),
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
          const effects = await buildExportEffects(deck);
          let savePath: string | null = null;
          try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            savePath = await save({
              filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
              defaultPath: `${deck.title}.pptx`,
            });
          } catch {
            // 非 Tauri 环境：下载到浏览器
            const blob = await exportDeckToBlob(deck, job.signal, effects);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${deck.title}.pptx`;
            a.click();
            // 延迟释放：Safari/WKWebView 在点击后立刻 revoke 可能中断下载
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return "download" as const;
          }
          if (savePath) {
            await exportDeck(deck, savePath, job.signal, effects);
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
      // 用户在任务面板取消导出时不应提示“导出失败”
      if ((e as Error).name === "AbortError") return;
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
        return "text-accent";
      case "succeeded":
        return "text-success";
      case "failed":
        return "text-danger";
      default:
        return "text-text-muted";
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* 顶部工具栏 */}
      <header className="flex h-10 items-center justify-between gap-2 border-b border-border bg-bg-elevated px-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            label={t("editor.backHome")}
            onClick={() => navigate("/")}
            icon={<ChevronLeft className="h-4 w-4" />}
          />
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
              className="w-56 rounded border border-accent bg-bg-base px-1.5 py-0.5 text-sm font-medium text-text-primary outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setTitleInput(deck?.title ?? t("editor.untitled"));
                setEditingTitle(true);
              }}
              className="min-w-0 max-w-[220px] truncate rounded px-1.5 py-0.5 text-sm font-medium text-text-primary hover:bg-bg-hover"
              title={deck?.title}
            >
              {deck?.title ?? t("editor.untitled")}
            </button>
          )}
          {deck && (
            <span className="shrink-0 text-xs text-text-muted">
              {t("editor.pageCount", { n: deck.slides.length })}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* 任务状态指示器 */}
          {hasActiveJobs && (
            <button
              onClick={() => setJobPanelOpen(!jobPanelOpen)}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("editor.activeJobsCount", { n: activeJobs.length })}
            </button>
          )}
          {failedJobs.length > 0 && !hasActiveJobs && (
            <button
              onClick={() => setJobPanelOpen(!jobPanelOpen)}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-danger/10 px-2.5 py-1 text-xs text-danger transition-colors hover:bg-danger/20"
            >
              {t("editor.failedJobsCount", { n: failedJobs.length })}
            </button>
          )}

          <div className="hidden lg:block">
            <ModelStatusChip />
          </div>
          <IconButton
            label={t("editor.outlinePanel")}
            aria-pressed={leftOpen}
            onClick={() => setLeftOpen((v) => !v)}
            className={leftOpen ? "text-accent" : ""}
            icon={<PanelLeft className="h-4 w-4" />}
          />
          <IconButton
            label={t("editor.aiPanel")}
            aria-pressed={rightOpen}
            onClick={() => setRightOpen((v) => !v)}
            className={rightOpen ? "text-accent" : ""}
            icon={<PanelRight className="h-4 w-4" />}
          />

          <div className="mx-2 hidden h-5 w-px bg-border xl:block" />

          {/* 低频操作在窄窗口收进溢出菜单，避免顶栏挤压 */}
          <div className="hidden xl:flex">
            <IconButton
              label={t("editor.deleteProject")}
              variant="danger"
              onClick={() => setDeleteConfirm(true)}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="mx-2 hidden h-5 w-px bg-border xl:block" />

          <div className="relative">
            <button
              ref={designTriggerRef}
              onClick={() => setDesignOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={designOpen}
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
                <div
                  className="absolute right-0 top-full z-20 mt-1 max-h-[calc(100vh-3.5rem)] w-80 origin-top-right overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-lg animate-dialog"
                  role="dialog"
                  aria-label={t("editor.design")}
                >
                  <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {t("editor.design")}
                    </span>
                    <IconButton
                      label={t("common.close")}
                      onClick={() => {
                        setDesignOpen(false);
                        designTriggerRef.current?.focus();
                      }}
                      icon={<X className="h-4 w-4" />}
                    />
                  </div>
                  <DesignPanel
                    design={deck?.design ?? DEFAULT_DESIGN}
                    onChange={(d) => setDesign(d)}
                    transition={deck?.transition}
                    entranceAnimation={deck?.entranceAnimation}
                    onTransitionChange={(tr) =>
                      useDeckStore.getState().setPlayback({ transition: tr })
                    }
                    onEntranceAnimationChange={(v) =>
                      useDeckStore.getState().setPlayback({
                        entranceAnimation: v,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>

          <IconButton
            label={t("home.exportProject")}
            onClick={() => void handleExportProject()}
            disabled={!deck}
            className="hidden xl:inline-flex"
            icon={<FileJson className="h-4 w-4" />}
          />
          <button
            onClick={() => setImportOpen(true)}
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary xl:flex"
          >
            <Upload className="h-3.5 w-3.5" />
            {t("editor.import")}
          </button>

          {/* 窄窗口的「更多」菜单：收纳删除项目/导出 JSON/导入 */}
          <div className="relative xl:hidden">
            <IconButton
              label={t("common.more")}
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              onClick={() => setOverflowOpen((v) => !v)}
              icon={<MoreHorizontal className="h-4 w-4" />}
            />
            {overflowOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOverflowOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-dialog"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOverflowOpen(false);
                      setImportOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("editor.import")}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOverflowOpen(false);
                      void handleExportProject();
                    }}
                    disabled={!deck}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
                  >
                    <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("home.exportProject")}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOverflowOpen(false);
                      setDeleteConfirm(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("editor.deleteProject")}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setPresenting(true)}
            disabled={!deck || deck.slides.length === 0}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30"
            title={t("editor.presentTooltip")}
          >
            <Monitor className="h-3.5 w-3.5" />
            {t("editor.present")}
          </button>
          {staleSlides.length > 0 && (
            <button
              onClick={() => void handleSyncStale()}
              disabled={syncingStale || exporting}
              title={t("editor.pagesStaleMessage", {
                n: staleSlides.length,
              })}
              className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {syncingStale ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {syncingStale
                ? t("editor.syncingStale")
                : t("editor.syncStale", { n: staleSlides.length })}
            </button>
          )}
          <Button
            variant="primary"
            onClick={handleExport}
            loading={exporting}
            disabled={!deck || deck.slides.length === 0 || hasHard}
            title={
              hasHard ? t("editor.qualityBlockExport") : t("common.exportPpt")
            }
          >
            {!exporting && (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {exporting ? t("common.exporting") : t("common.exportPpt")}
          </Button>
          {hasHard && (
            <button
              onClick={() => {
                setRightOpen(true);
                setInspectorTab("ai");
              }}
              className="shrink-0 rounded-md bg-danger/10 px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/20"
              title={t("editor.qualityBlockExport")}
            >
              {t("editor.qualityNotMet")}
            </button>
          )}
        </div>
      </header>

      {/* 任务面板 */}
      {jobPanelOpen && (hasActiveJobs || failedJobs.length > 0) && (
        <div className="max-h-44 overflow-y-auto border-b border-border bg-bg-surface px-4 py-2">
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
              <IconButton
                label={t("common.close")}
                size="sm"
                onClick={() => setJobPanelOpen(false)}
                icon={<X className="h-3.5 w-3.5" />}
              />
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
                    <X className="h-3 w-3 text-danger" />
                  )}
                  {job.status === "succeeded" && (
                    <Check className="h-3 w-3 text-success" />
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
                      aria-label={t("editor.copyError")}
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
          <>
            <aside
              className="flex flex-col border-r border-border bg-bg-elevated"
              style={{ width: leftWidth }}
            >
              <OutlineEditor
                onSelectSlide={setSelectedIndex}
                selectedIndex={selectedIndex}
              />
            </aside>
            <PanelDivider
              onPointerDown={(e) =>
                startPanelResize(e, "left", leftWidthRef, setLeftWidth)
              }
              side="left"
              widthRef={leftWidthRef}
              setWidth={setLeftWidth}
            />
          </>
        ) : (
          <aside className="flex w-9 flex-col items-center border-r border-border bg-bg-elevated py-2">
            <button
              onClick={() => setLeftOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent transition-colors hover:bg-accent hover:text-on-accent"
              aria-label={t("editor.expandOutline")}
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
              onUpdateSlideSvg={(slideId, svg) =>
                useDeckStore
                  .getState()
                  .updateSlide(slideId, { svg, svgStale: false })
              }
              onAnnotateElement={(slideId, instruction, ctx) =>
                void handleAnnotateElement(slideId, instruction, ctx)
              }
              generatingIndex={generatingIndex}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-text-muted">
              {t("editor.previewPlaceholder")}
            </div>
          )}
        </main>

        {/* 右栏：属性检查器（AI / 页面 / 图表 / 配图 / 备注） */}
        {rightOpen && deck ? (
          <>
            <PanelDivider
              onPointerDown={(e) =>
                startPanelResize(e, "right", rightWidthRef, setRightWidth)
              }
              side="right"
              widthRef={rightWidthRef}
              setWidth={setRightWidth}
            />
            <aside
              className="flex flex-col border-l border-border bg-bg-elevated"
              style={{ width: rightWidth }}
            >
              <InspectorPanel
                deck={deck}
                selectedIndex={selectedIndex}
                activeTab={inspectorTab}
                onTabChange={setInspectorTab}
              />
            </aside>
          </>
        ) : (
          <aside className="flex w-9 flex-col items-center border-l border-border bg-bg-elevated py-2">
            <button
              onClick={() => setRightOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent transition-colors hover:bg-accent hover:text-on-accent"
              aria-label={t("editor.expandAiPanel")}
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

const PANEL_WIDTH_MIN = 220;
const PANEL_WIDTH_MAX = 420;

function readPanelWidth(storageKey: string): number {
  try {
    const v = Number(window.localStorage.getItem(storageKey));
    if (Number.isFinite(v) && v >= PANEL_WIDTH_MIN && v <= PANEL_WIDTH_MAX) {
      return v;
    }
  } catch {
    // localStorage 不可用时使用默认宽度
  }
  return 280;
}

/** 拖拽调宽：side=left 向右拖增宽，side=right 向左拖增宽；松手后记忆 */
function startPanelResize(
  e: React.PointerEvent,
  side: "left" | "right",
  widthRef: { current: number },
  setWidth: (w: number) => void,
) {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = widthRef.current;
  const storageKey = side === "left" ? "editor.leftWidth" : "editor.rightWidth";
  const onMove = (ev: PointerEvent) => {
    const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
    setWidth(
      Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, startWidth + delta)),
    );
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    try {
      window.localStorage.setItem(storageKey, String(widthRef.current));
    } catch {
      // 忽略持久化失败
    }
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/** 面板间拖拽分隔条：4px 命中区，hover 显示强调色 */
function PanelDivider({
  onPointerDown,
  side,
  widthRef,
  setWidth,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  side: "left" | "right";
  widthRef: { current: number };
  setWidth: (w: number) => void;
}) {
  // 键盘等效操作：方向键步进 16px，Home/End 到边界（拖拽把柄的可键盘替代）
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 16;
    const clamp = (w: number) =>
      Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, w));
    let handled = true;
    if (e.key === "ArrowLeft") {
      // 左栏左箭头变窄，右栏左箭头变宽
      setWidth(clamp(widthRef.current + (side === "left" ? -step : step)));
    } else if (e.key === "ArrowRight") {
      setWidth(clamp(widthRef.current + (side === "left" ? step : -step)));
    } else if (e.key === "Home") {
      setWidth(PANEL_WIDTH_MIN);
    } else if (e.key === "End") {
      setWidth(PANEL_WIDTH_MAX);
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      try {
        window.localStorage.setItem(
          side === "left" ? "editor.leftWidth" : "editor.rightWidth",
          String(widthRef.current),
        );
      } catch {
        /* 存储不可用时忽略 */
      }
    }
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={widthRef.current}
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      aria-label={
        side === "left" ? "outline panel width" : "inspector panel width"
      }
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group/divider relative z-10 -mx-0.5 w-1 shrink-0 cursor-col-resize select-none py-2 focus-visible:outline-none focus-visible:bg-accent/40"
    >
      <div className="h-full w-px bg-transparent transition-colors group-hover/divider:bg-accent/60" />
    </div>
  );
}

/**
 * 顶栏模型状态 chip：状态点（绿=就绪/灰=未加载）+ 当前模型名称。
 * 本地模型按「实际已加载的模型路径」判定（tier 切换后未重载不误报绿）；
 * 远程模型无加载概念，配置了 API Key 即绿点。
 */ function ModelStatusChip() {
  const t = useT();
  const settings = useSettingsStore((s) => s.settings);
  const modelState = useModelStore((s) => s.state);
  const tier = useModelStore((s) => s.tier);
  const modelPath = useModelStore((s) => s.modelPath);
  const progress = useModelStore((s) => s.progress);
  const refresh = useModelStore((s) => s.refresh);
  const ensureReady = useModelStore((s) => s.ensureReady);
  const cfg = settings.providers[settings.activeProvider];
  const local = !!cfg && isLocalProviderConfig(cfg);

  useEffect(() => {
    if (local) void refresh();
  }, [local, refresh]);

  if (!cfg) return null;

  const loaded = local ? modelState === "loaded" && !!modelPath : !!cfg.apiKey;
  const def = MODEL_REGISTRY[tier];
  const name = local ? def.displayName.split(" ")[0] : cfg.label;
  const busy = modelState === "downloading" || modelState === "loading";
  // 未就绪时提供就地操作：已下载 → 加载；未下载/出错 → 下载并加载
  const actionLabel =
    modelState === "downloaded" ? t("model.load") : t("model.download");
  const statusText = local
    ? modelState === "downloading"
      ? progress?.phase === "verifying"
        ? t("model.verifying")
        : progress && progress.total
          ? t("model.downloading", {
              percent: Math.round((progress.downloaded / progress.total) * 100),
            })
          : // 总量未知（服务器未回 Content-Length）时不显示误导性 0%
            t("model.downloadingIndeterminate")
      : modelState === "loading"
        ? t("common.loading")
        : loaded
          ? t("model.loaded")
          : modelState === "absent" || modelState === "error"
            ? t("model.absent")
            : modelState === "unsupported"
              ? t("model.unsupported")
              : modelState === "unknown"
                ? t("common.loading")
                : t("model.downloaded")
    : cfg.apiKey
      ? t("settings.inUse")
      : t("settings.missingApiKey");

  return (
    <span
      title={statusText}
      className="flex items-center gap-1.5 rounded-full border border-border bg-bg-surface px-2.5 py-0.5 text-xs text-text-secondary"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          loaded ? "bg-success" : "bg-text-muted"
        }`}
      />
      {name}
      {local &&
        !loaded &&
        modelState !== "unsupported" &&
        modelState !== "unknown" && (
          <button
            type="button"
            title={statusText}
            disabled={busy}
            onClick={() => void ensureReady().catch(() => {})}
            className="flex items-center gap-1 rounded-full bg-accent px-2 py-px text-[11px] text-on-accent transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {busy ? statusText : actionLabel}
          </button>
        )}
    </span>
  );
}
