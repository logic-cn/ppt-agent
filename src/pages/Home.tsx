import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Presentation,
  Plus,
  FileText,
  Settings,
  Clock,
  Trash2,
} from "lucide-react";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import { useProjectStore } from "@/store/project";
import { deleteDeck } from "@/services/storage";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PresetLibraryDialog } from "@/components/preset/PresetLibraryDialog";
import type { DeckPreset } from "@/types/preset";
import type { Slide } from "@/types/deck";
import { useT } from "@/hooks/use-page-t";

export default function Home() {
  const navigate = useNavigate();
  const t = useT();
  const createDeck = useDeckStore((s) => s.createDeck);
  const { recent, loading, loadRecent } = useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);

  useEffect(() => {
    void loadRecent();
    const onShow = () => void loadRecent();
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [loadRecent]);

  const createProject = async () => {
    const deck = await createDeck();
    navigate(`/editor/${deck.id}?new=1`);
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
    if (deck.title === "未命名项目") {
      useDeckStore.getState().setTitle(topic);
    }
    navigate(`/editor/${deck.id}?new=1`);
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
          onClick={() => navigate("/settings")}
          className="text-text-secondary hover:text-text-primary"
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
          <h2 className="mb-4 text-lg font-semibold">
            {t("home.recentProjects")}
          </h2>
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
                      {new Date(p.updatedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p.id);
                    }}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    title={t("home.deleteProject")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
              if (deleteTarget) {
                await deleteDeck(deleteTarget);
                setDeleteTarget(null);
                void loadRecent();
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
        </div>
      </main>
    </div>
  );
}
