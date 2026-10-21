import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { Deck, Slide } from "@/types/deck";
import { DEFAULT_DESIGN } from "@/types/design";
import { useDeckStore } from "@/store/deck";
import { runJob } from "@/store/job";
import { useQualityStore } from "@/store/quality";
import { checkDeckQuality } from "@/services/quality";
import { generateSlideContent, buildContentContext } from "@/services/content";
import { ChatPanel } from "@/components/chat";
import { SlideTab } from "./slide-tab";
import { ChartTab } from "./chart-tab";
import { ImageTab } from "./image-tab";
import { NotesTab } from "./notes-tab";
import { useT } from "@/hooks/use-page-t";

type Tab = "ai" | "slide" | "chart" | "image" | "notes";

interface Props {
  deck: Deck;
  selectedIndex: number;
  onSelectIndex?: (index: number) => void;
}

export function InspectorPanel({ deck, selectedIndex }: Props) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>("ai");
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const updateSlide = useDeckStore((s) => s.updateSlide);
  const slide: Slide | undefined = deck.slides[selectedIndex];

  const handleUpdate = (patch: Partial<Slide>) => {
    if (!slide) return;
    updateSlide(slide.id, patch);
  };

  const runQualityCheck = () => {
    const current = useDeckStore.getState().deck;
    useQualityStore
      .getState()
      .setReport(current ? checkDeckQuality(current) : null);
  };

  const collectPatch = (
    result: Awaited<ReturnType<typeof generateSlideContent>>,
  ): Partial<Slide> => {
    const patch: Partial<Slide> = {};
    if (result.body) patch.body = result.body;
    if (result.bullets) patch.bullets = result.bullets;
    if (result.chart) patch.chart = result.chart;
    if (result.notes) patch.notes = result.notes;
    return patch;
  };

  const handleGenerateContent = async () => {
    if (!slide || generating || generatingAll) return;
    setGenerating(true);
    try {
      await runJob(
        {
          type: "content.generate",
          title: t("inspector.generateContentJob", { title: slide.title }),
          canCancel: true,
        },
        async (job) => {
          const result = await generateSlideContent({
            slideTitle: slide.title,
            context: buildContentContext(deck, slide),
            design: DEFAULT_DESIGN,
            signal: job.signal,
          });
          handleUpdate(collectPatch(result));
          runQualityCheck();
        },
      );
    } catch {
      // 失败/取消已由 runJob 写入任务面板，此处仅结束本地 loading 状态
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (generating || generatingAll) return;
    const targets = deck.slides.filter(
      (s) =>
        s.title.trim() &&
        !s.body &&
        (!s.bullets || s.bullets.length === 0) &&
        s.layout !== "cover" &&
        s.layout !== "closing",
    );
    if (targets.length === 0) return;
    setGeneratingAll(true);
    try {
      await runJob(
        {
          type: "content.generate_batch",
          title: t("inspector.batchGenerateJob", { count: targets.length }),
          canCancel: true,
        },
        async (job) => {
          for (const s of targets) {
            if (job.signal.aborted) {
              throw new DOMException("已取消", "AbortError");
            }
            const result = await generateSlideContent({
              slideTitle: s.title,
              context: buildContentContext(deck, s),
              design: DEFAULT_DESIGN,
              signal: job.signal,
            });
            updateSlide(s.id, collectPatch(result));
          }
          runQualityCheck();
        },
      );
    } catch {
      // 失败/取消已由 runJob 写入任务面板，此处仅结束本地 loading 状态
    } finally {
      setGeneratingAll(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "ai", label: "AI" },
    { key: "slide", label: t("inspector.tabSlide") },
    { key: "chart", label: t("inspector.tabChart") },
    { key: "image", label: t("inspector.tabImage") },
    { key: "notes", label: t("inspector.tabNotes") },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tab 切换 */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
              activeTab === t.key
                ? "border-b-2 border-accent text-accent font-semibold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-3 py-3">
        {activeTab === "ai" && <ChatPanel />}

        {activeTab === "slide" && slide ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => void handleGenerateContent()}
                disabled={generating || generatingAll}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                    {t("common.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />{" "}
                    {t("inspector.generatePage")}
                  </>
                )}
              </button>
              <button
                onClick={() => void handleGenerateAll()}
                disabled={generating || generatingAll}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50"
              >
                {generatingAll ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                    {t("inspector.filling")}
                  </>
                ) : (
                  t("inspector.fillEmptyPages")
                )}
              </button>
            </div>
            <SlideTab slide={slide} onUpdate={handleUpdate} />
          </div>
        ) : activeTab === "slide" ? (
          <EmptyState message={t("inspector.selectPage")} />
        ) : null}

        {activeTab === "chart" && slide ? (
          <ChartTab slide={slide} onUpdate={handleUpdate} />
        ) : activeTab === "chart" ? (
          <EmptyState message={t("inspector.selectPage")} />
        ) : null}

        {activeTab === "image" && slide ? (
          <ImageTab slide={slide} onUpdate={handleUpdate} />
        ) : activeTab === "image" ? (
          <EmptyState message={t("inspector.selectPage")} />
        ) : null}

        {activeTab === "notes" && slide ? (
          <NotesTab slide={slide} onUpdate={handleUpdate} />
        ) : activeTab === "notes" ? (
          <EmptyState message={t("inspector.selectPage")} />
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-muted">
      {message}
    </div>
  );
}
