import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Presentation,
  Plus,
  FileText,
  Settings,
  Clock,
  Trash2,
  Download,
  Upload,
  Loader2,
} from "lucide-react";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import { useProjectStore } from "@/store/project";
import { deleteDeck, loadDeck, isUntitledDeck } from "@/services/storage";
import { importDeckJson, serializeDeckJson } from "@/services/project-backup";
import { saveTextFile } from "@/services/file-save";
import { useToastStore } from "@/store/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PresetLibraryDialog } from "@/components/preset/PresetLibraryDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import type { DeckPreset } from "@/types/preset";
import type { Slide } from "@/types/deck";
import { useT } from "@/hooks/use-page-t";
import { useSettingsStore } from "@/store/settings";

export default function Home() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useSettingsStore((s) => s.settings.lang);
  const createDeck = useDeckStore((s) => s.createDeck);
  const { recent, loading, loadRecent } = useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((s) => s.add);

  useEffect(() => {
    // 列表加载失败不产生未处理的 Promise 拒绝；失败时保持空状态，
    // 页面重新获得焦点时会自动重试
    void loadRecent().catch(() => {});
    const onShow = () => void loadRecent().catch(() => {});
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [loadRecent]);

  const createProject = async () => {
    try {
      const deck = await createDeck();
      navigate(`/editor/${deck.id}?new=1`);
    } catch (e) {
      addToast({
        type: "error",
        title: t("common.error"),
        message: (e as Error).message,
      });
    }
  };

  const handlePresetGenerate = async (
    preset: DeckPreset,
    topic: string,
    slides: Slide[],
  ) => {
    const deck = await createDeck();
    useDeckStore.getState().setDesign(preset.design);
    useQualityStore.getState().setPendingRules(preset.qualityRules ?? []);
    await useDeckStore.getState().replaceSlides(slides);
    if (isUntitledDeck(deck)) {
      useDeckStore.getState().setTitle(topic);
    }
    navigate(`/editor/${deck.id}?new=1`);
  };

  const handleImportFile = async (file: File) => {
    if (importing) return;
    setImporting(true);
    try {
      const raw = await file.text();
      const result = await importDeckJson(raw, t("home.importedSuffix"));
      await loadRecent();
      addToast({
        type: "success",
        title: t("home.importProjectSuccess"),
        message: t("home.importProjectSuccessMessage", {
          title: result.deck.title,
        }),
      });
      if (result.warnings.length > 0) {
        addToast({
          type: "warning",
          title: t("home.importWarningsTitle"),
          message: t("home.importWarningsMessage", {
            n: result.warnings.length,
          }),
        });
      }
      navigate(`/editor/${result.deck.id}`);
    } catch (e) {
      addToast({
        type: "error",
        title: t("home.importProjectFailed"),
        message: (e as Error).message,
      });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const handleExportProject = async (id: string) => {
    try {
      const deck = await loadDeck(id);
      if (!deck) throw new Error(t("editor.projectNotFound"));
      const result = await saveTextFile({
        content: serializeDeckJson(deck),
        defaultName: `${deck.title}.json`,
        extension: "json",
        label: t("home.projectJsonLabel"),
      });
      if (result) {
        addToast({
          type: "success",
          title: t("home.exportProjectSuccess"),
          message: t("home.exportProjectSuccessMessage", {
            title: deck.title,
          }),
        });
      }
    } catch (e) {
      addToast({
        type: "error",
        title: t("home.exportProjectFailed"),
        message: (e as Error).message,
      });
    }
  };

  const getSlideSummary = (slidesCount: number) =>
    t("home.slideCountSummary", { slidesCount });

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-border bg-bg-elevated px-6 py-3">
        <div className="flex items-center gap-2">
          <Presentation className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold">PPT Agent</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={t("common.settings")}
          title={t("common.settings")}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* 主体 */}
      <main className="flex-1 overflow-auto px-12 py-10">
        <div className="mx-auto max-w-5xl">
          {/* 新建入口 */}
          <h1 className="mb-6 text-2xl font-semibold">
            {t("home.startCreating")}
          </h1>
          <div className="mb-12 grid grid-cols-3 gap-4">
            <button
              onClick={createProject}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg-elevated p-8 transition-all hover:border-accent hover:shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-110">
                <Plus className="h-7 w-7" />
              </div>
              <div className="text-center">
                <div className="font-medium">{t("home.newBlankDeck")}</div>
                <div className="mt-1 text-sm text-text-muted">
                  {t("home.generateFromTopic")}
                </div>
              </div>
            </button>

            <button
              onClick={async () => {
                const deck = await createDeck();
                navigate(`/editor/${deck.id}?import=1`);
              }}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg-elevated p-8 transition-all hover:border-accent hover:shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-110">
                <FileText className="h-7 w-7" />
              </div>
              <div className="text-center">
                <div className="font-medium">{t("home.importDocument")}</div>
                <div className="mt-1 text-sm text-text-muted">
                  Word / Markdown / URL
                </div>
              </div>
            </button>

            <button
              onClick={() => setPresetOpen(true)}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-bg-elevated p-8 transition-all hover:border-accent hover:shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-110">
                <FileText className="h-7 w-7" />
              </div>
              <div className="text-center">
                <div className="font-medium">{t("preset.library")}</div>
                <div className="mt-1 text-sm text-text-muted">
                  {t("home.pickStyleHint")}
                </div>
              </div>
            </button>
          </div>

          {/* 最近项目 */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("home.recentProjects")}
            </h2>
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importing ? t("home.importingProject") : t("home.importProject")}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              aria-label={t("home.importProject")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="ml-3 text-sm">{t("common.loading")}</span>
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-elevated p-8">
              <h2 className="mb-4 text-lg font-semibold">
                {t("home.quickStart")}
              </h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    1
                  </div>
                  <h3 className="font-medium">{t("home.stepFillTopic")}</h3>
                  <p className="text-sm text-text-muted">
                    {t("home.stepFillTopicDesc")}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    2
                  </div>
                  <h3 className="font-medium">{t("home.stepAdjustOutline")}</h3>
                  <p className="text-sm text-text-muted">
                    {t("home.stepAdjustOutlineDesc")}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    3
                  </div>
                  <h3 className="font-medium">{t("common.exportPpt")}</h3>
                  <p className="text-sm text-text-muted">
                    {t("home.stepExportDesc")}
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-md bg-bg-surface px-4 py-3 text-sm text-text-muted">
                {t("home.apiKeyHint")}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-xl border border-border bg-bg-elevated p-5 text-left transition-all hover:border-accent hover:shadow-sm"
                >
                  <button
                    onClick={() => navigate(`/editor/${p.id}`)}
                    className="w-full text-left"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft/50">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <span className="rounded-md bg-bg-surface px-2 py-0.5 text-xs text-text-muted">
                        {getSlideSummary(p.slidesCount)}
                      </span>
                    </div>
                    <h3 className="mb-1 truncate font-medium text-text-primary group-hover:text-accent">
                      {p.title}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="h-3 w-3" />
                      {new Date(p.updatedAt).toLocaleDateString(
                        lang === "en" ? "en-US" : "zh-CN",
                      )}
                    </p>
                  </button>
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleExportProject(p.id);
                      }}
                      className="rounded-md p-1.5 text-text-muted transition hover:bg-accent/10 hover:text-accent"
                      title={t("home.exportProject")}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(p.id);
                      }}
                      className="rounded-md p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                      title={t("home.deleteProject")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ConfirmDialog
            open={deleteTarget !== null}
            title={t("home.deleteProject")}
            message={t("home.deleteProjectConfirm")}
            confirmText={t("common.delete")}
            onConfirm={async () => {
              if (!deleteTarget) return;
              try {
                await deleteDeck(deleteTarget);
                setDeleteTarget(null);
                void loadRecent().catch(() => {});
              } catch (e) {
                // 删除失败保留确认框，让用户可重试而不是静默失败
                addToast({
                  type: "error",
                  title: t("common.error"),
                  message: (e as Error).message,
                });
              }
            }}
            onCancel={() => setDeleteTarget(null)}
          />

          <PresetLibraryDialog
            open={presetOpen}
            onClose={() => setPresetOpen(false)}
            onGenerate={(params) =>
              handlePresetGenerate(params.preset, params.topic, params.slides)
            }
          />

          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}
