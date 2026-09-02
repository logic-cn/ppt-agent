import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { PresetLibrary } from "./PresetLibrary";
import { buildDeckSvgs } from "@/engine/svg/pipeline";
import { buildTemplateGenerationContext } from "@/presets/template-context";
import type { DeckPreset } from "@/types/preset";
import type { Deck, Slide } from "@/types/deck";

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerate: (params: {
    preset: DeckPreset;
    topic: string;
    slides: Slide[];
  }) => void | Promise<void>;
}

export function PresetPickerDialog({ open, onClose, onGenerate }: Props) {
  const [preset, setPreset] = useState<DeckPreset | null>(null);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  const handlePick = (p: DeckPreset) => {
    setPreset(p);
    setTopic("");
    setError(null);
  };

  const handleGenerate = async () => {
    if (!preset || !topic.trim() || generating) return;
    setGenerating(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // X1 管线：用 buildDeckSvgs 生成 svg 设计真相（构造临时 deck 供对齐页数）
      const tempDeck = {
        id: "x1-temp",
        title: topic.trim(),
        design: preset.design,
        slides: [],
        version: 2,
        createdAt: 0,
        updatedAt: 0,
      } as unknown as Deck;
      const newDeck = await buildDeckSvgs(tempDeck, preset.design, {
        topic: topic.trim(),
        pageCount: Math.max(preset.slides.length, 1),
        templateCtx: buildTemplateGenerationContext(preset.id) ?? undefined,
        signal: controller.signal,
      });
      const slides = newDeck.slides;
      await onGenerate({ preset, topic: topic.trim(), slides });
      setPreset(null);
      onClose();
    } catch (e) {
      if (controller.signal.aborted) return;
      setError((e as Error).message || "生成失败，请重试");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-bg-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="preset-picker-title" className="text-base font-semibold">
            {preset ? "输入主题" : "示例库"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {!preset ? (
            <PresetLibrary onPick={handlePick} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {preset.name}
                </span>
                <button
                  onClick={() => {
                    setPreset(null);
                    setError(null);
                  }}
                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent"
                >
                  <ArrowLeft className="h-3 w-3" />
                  返回
                </button>
              </div>
              <p className="text-xs text-text-muted">
                已选风格骨架，请输入你的主题，将基于此风格生成专属大纲。
              </p>
              <input
                type="text"
                value={topic}
                autoFocus
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder="输入主题，如：Q3 业务复盘"
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-ai to-orange-400 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 生成中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> 生成大纲
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
