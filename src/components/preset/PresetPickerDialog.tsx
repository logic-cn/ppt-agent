import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { PresetLibrary } from "./PresetLibrary";
import { buildDeckSvgs } from "@/engine/svg/pipeline";
import { buildTemplateGenerationContext } from "@/presets/template-context";
import { getPresetDisplay } from "@/presets/display";
import { withAppLanguage } from "@/services/generation/generation-options";
import { useSettingsStore } from "@/store/settings";
import type { DeckPreset } from "@/types/preset";
import type { Deck, Slide } from "@/types/deck";
import { useT } from "@/hooks/use-page-t";

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
  const t = useT();
  const lang = useSettingsStore((s) => s.settings.lang);
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

  // 关闭后彻底复位，保证再次打开时回到模板列表而不是上次的主题输入页
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setPreset(null);
    setTopic("");
    setError(null);
    setGenerating(false);
  }, [open]);

  // 生成进行中关闭弹框（Esc/背景/X）：先终止生成，避免后台静默改写 deck
  const closeSafely = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    onClose();
  };

  // Esc 关闭（生成中同样先终止）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSafely();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const presetDisplay = preset ? getPresetDisplay(preset, lang) : null;

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
      const templateCtx =
        buildTemplateGenerationContext(preset.id) ?? undefined;
      const newDeck = await buildDeckSvgs(tempDeck, preset.design, {
        topic: topic.trim(),
        pageCount: Math.max(preset.slides.length, 1),
        templateCtx,
        // 模板声明的默认生成选项（场景/语气等）随 options 注入提示词
        options: withAppLanguage(templateCtx?.defaultOptions ?? {}, lang),
        signal: controller.signal,
      });
      const slides = newDeck.slides;
      await onGenerate({ preset, topic: topic.trim(), slides });
      setPreset(null);
      onClose();
    } catch (e) {
      if (controller.signal.aborted) return;
      setError((e as Error).message || t("preset.generateError"));
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
      onClick={closeSafely}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-bg-elevated shadow-xl animate-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="preset-picker-title" className="text-base font-semibold">
            {preset ? t("preset.enterTopic") : t("preset.library")}
          </h2>
          <button
            onClick={closeSafely}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("common.close")}
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
                  {presetDisplay?.name}
                </span>
                <button
                  onClick={() => {
                    setPreset(null);
                    setError(null);
                  }}
                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {t("preset.back")}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                {t("preset.enterTopicPrompt")}
              </p>
              <input
                type="text"
                value={topic}
                autoFocus
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !(e.nativeEvent as KeyboardEvent).isComposing
                  ) {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder={t("preset.topicPlaceholder")}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-ai to-ai-hover px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                    {t("common.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />{" "}
                    {t("preset.generateOutline")}
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
