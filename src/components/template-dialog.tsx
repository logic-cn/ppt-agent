import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, X, Sparkles, Loader2 } from "lucide-react";
import type { TemplatePack } from "@/types/template";
import { getTemplatePacks, buildContextualPrompt } from "@/templates";
import { generateOutline } from "@/services/outline";

export interface TemplateSelectResult {
  pack: TemplatePack;
  topic: string;
  mode: "ai" | "static";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: TemplateSelectResult) => void;
}

export function TemplateDialog({ open, onClose, onSelect }: Props) {
  const [selected, setSelected] = useState<TemplatePack | null>(null);
  const [topic, setTopic] = useState("");
  const [pageCount, setPageCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selected) {
          setSelected(null);
          return;
        }
        onClose();
      }
    },
    [onClose, selected],
  );

  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setTopic("");
    setPageCount(10);
    setGenerating(false);
    const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const packs = getTemplatePacks();

  const handleAiGenerate = async () => {
    if (!selected || !topic.trim()) return;
    setGenerating(true);
    try {
      await generateOutline({
        topic: topic.trim(),
        pageCount,
        contextualPrompt: buildContextualPrompt(selected, topic.trim()),
        signal: new AbortController().signal,
      });
      onSelect({ pack: selected, topic: topic.trim(), mode: "ai" });
    } catch (e) {
      console.error("AI 生成大纲失败:", e);
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  const scenarioLabel: Record<string, string> = {
    business_review: "复盘",
    pitch: "路演",
    market_analysis: "分析",
    training: "培训",
    proposal: "提案",
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-dialog-title"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-3">
          <h2 id="template-dialog-title" className="text-base font-semibold">
            {selected ? "配置主题" : "选择模板"}
          </h2>
          <button
            onClick={() => {
              if (selected) {
                setSelected(null);
                return;
              }
              onClose();
            }}
            className="rounded p-1 text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selected ? (
          /* 二级：主题输入 + 操作按钮 */
          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-accent" />
                <span className="font-medium text-sm">{selected.name}</span>
                <span className="rounded bg-accent-soft/50 px-1.5 py-0.5 text-xs text-accent">
                  {scenarioLabel[selected.scenario] ?? selected.scenario}
                </span>
              </div>

              <label className="block text-sm font-medium text-text-primary mb-1">
                请输入 PPT 主题
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`例如：${selected.defaultOptions.topic || "输入主题…"}`}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                autoFocus
              />

              <label className="block text-sm font-medium text-text-primary mt-3 mb-1">
                建议页数
              </label>
              <input
                type="range"
                min={5}
                max={25}
                value={pageCount}
                onChange={(e) => setPageCount(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-text-muted mt-0.5">
                <span>5</span>
                <span>{pageCount} 页</span>
                <span>25</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() =>
                  onSelect({
                    pack: selected,
                    topic: topic.trim() || selected.name,
                    mode: "static",
                  })
                }
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-hover"
              >
                直接创建（静态）
              </button>
              <button
                onClick={handleAiGenerate}
                disabled={!topic.trim() || generating}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-purple-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 生成中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> AI 生成
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-text-muted pt-1">
              AI 生成将遵循模板的结构编排，并使用 AI
              填充具体内容。静态创建直接使用模板预定义的示例内容。
            </p>
          </div>
        ) : (
          /* 一级：模板选择列表 */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
            {packs.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="group flex flex-col items-start gap-1.5 rounded-lg border border-border p-3 text-left transition hover:border-accent hover:bg-bg-hover"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft/50 group-hover:bg-accent-soft">
                  <FileText className="h-4 w-4 text-accent" />
                </div>
                <div className="w-full min-w-0">
                  <div className="flex items-center gap-1">
                    <div className="truncate text-sm font-medium text-text-primary group-hover:text-accent">
                      {p.name}
                    </div>
                    <span className="shrink-0 rounded bg-accent-soft/30 px-1 py-0.5 text-[10px] text-accent">
                      {scenarioLabel[p.scenario] ?? p.scenario}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                    {p.description}
                  </div>
                  <div className="mt-1 text-[11px] text-text-muted">
                    {p.slides.length} 页
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border px-4 py-2.5 text-xs text-text-muted">
          选择模板后可以指定具体主题，AI 将根据模板结构自动生成内容
        </div>
      </div>
    </div>
  );
}
