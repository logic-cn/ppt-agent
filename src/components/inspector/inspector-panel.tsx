import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { Deck, Slide } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { useJobStore } from "@/store/job";
import { useQualityStore } from "@/store/quality";
import { checkDeckQuality } from "@/services/quality";
import { generateSlideContent, buildContentContext } from "@/services/content";
import { ChatPanel } from "@/components/chat";
import { SlideTab } from "./slide-tab";
import { ChartTab } from "./chart-tab";
import { ImageTab } from "./image-tab";
import { NotesTab } from "./notes-tab";

type Tab = "ai" | "slide" | "chart" | "image" | "notes";

interface Props {
  deck: Deck;
  selectedIndex: number;
  onSelectIndex?: (index: number) => void;
  onGenerateImage?: (slideId: string) => void;
}

export function InspectorPanel({
  deck,
  selectedIndex,
  onGenerateImage,
}: Props) {
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
    return patch;
  };

  const handleGenerateContent = async () => {
    if (!slide || generating || generatingAll) return;
    setGenerating(true);
    const jobStore = useJobStore.getState();
    const job = jobStore.startJob({
      type: "content.generate",
      title: `生成内容：${slide.title}`,
      canCancel: true,
    });
    try {
      const result = await generateSlideContent({
        slideTitle: slide.title,
        context: buildContentContext(deck, slide),
        signal: job.signal,
      });
      job.succeed("内容已生成");
      handleUpdate(collectPatch(result));
      runQualityCheck();
    } catch (e) {
      if (job.signal.aborted) job.cancel();
      else job.fail(e);
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
    const jobStore = useJobStore.getState();
    const job = jobStore.startJob({
      type: "content.generate_batch",
      title: `批量生成内容（${targets.length} 页）`,
      canCancel: true,
    });
    try {
      for (const s of targets) {
        if (job.signal.aborted) break;
        const result = await generateSlideContent({
          slideTitle: s.title,
          context: buildContentContext(deck, s),
          signal: job.signal,
        });
        updateSlide(s.id, collectPatch(result));
      }
      if (job.signal.aborted) {
        job.cancel();
      } else {
        job.succeed("批量内容已生成");
        runQualityCheck();
      }
    } catch (e) {
      if (job.signal.aborted) job.cancel();
      else job.fail(e);
    } finally {
      setGeneratingAll(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "ai", label: "AI" },
    { key: "slide", label: "页面" },
    { key: "chart", label: "图表" },
    { key: "image", label: "配图" },
    { key: "notes", label: "备注" },
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> AI 生成本页
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 填充中…
                  </>
                ) : (
                  "AI 填充全部空页"
                )}
              </button>
            </div>
            <SlideTab slide={slide} onUpdate={handleUpdate} />
          </div>
        ) : activeTab === "slide" ? (
          <EmptyState message="请选择一页" />
        ) : null}

        {activeTab === "chart" && slide ? (
          <ChartTab slide={slide} onUpdate={handleUpdate} />
        ) : activeTab === "chart" ? (
          <EmptyState message="请选择一页" />
        ) : null}

        {activeTab === "image" && slide ? (
          <ImageTab
            slide={slide}
            onUpdate={handleUpdate}
            onGenerateImage={onGenerateImage}
          />
        ) : activeTab === "image" ? (
          <EmptyState message="请选择一页" />
        ) : null}

        {activeTab === "notes" && slide ? (
          <NotesTab slide={slide} onUpdate={handleUpdate} />
        ) : activeTab === "notes" ? (
          <EmptyState message="请选择一页" />
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
