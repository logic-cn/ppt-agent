import { X, Sparkles } from "lucide-react";
import { getExamples } from "@/examples";
import { getPalette } from "@/design/palettes";
import type { DesignLock } from "@/types/design";

interface GalleryPanelProps {
  onPick: (design: DesignLock) => void;
  onClose: () => void;
}

/**
 * 样例画廊：展示内置 getExamples()，每张卡片显示名称 + 首屏缩略 + "用此风格"。
 * 点击后把 example.design 写回新 deck 的 design（由父级负责 createDeck + setDesign）。
 */
export function GalleryPanel({ onPick, onClose }: GalleryPanelProps) {
  const examples = getExamples();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                样例画廊
              </h2>
              <p className="text-xs text-text-muted">
                挑一个风格作为起点，下一步再输入主题生成大纲
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-auto p-6 sm:grid-cols-3">
          {examples.map((example) => {
            const first = example.slides[0];
            const palette = getPalette(example.design.palette);
            const c = palette?.colors;
            return (
              <div
                key={example.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-all hover:border-accent hover:shadow-sm"
              >
                <div
                  className="relative flex h-28 items-end overflow-hidden p-3"
                  style={{
                    background: c ? c.background : "#0C1929",
                    color: c ? c.text : "#F1F5F9",
                  }}
                >
                  <div
                    className="absolute left-0 top-0 h-full w-1.5"
                    style={{ background: c ? c.primary : "#60A5FA" }}
                  />
                  <div className="absolute right-2 top-2 flex gap-1">
                    {c && (
                      <>
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                          style={{ background: c.accent }}
                        />
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                          style={{ background: c.secondary }}
                        />
                      </>
                    )}
                  </div>
                  <span className="line-clamp-3 text-xs font-medium leading-snug">
                    {first?.title ?? example.name}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">
                      {example.name}
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">
                      {example.slides.length} 页 ·{" "}
                      {example.design.mode === "pyramid"
                        ? "结论先行"
                        : example.design.mode === "narrative"
                          ? "张力叙事"
                          : example.design.mode === "instructional"
                            ? "教学导向"
                            : example.design.mode === "showcase"
                              ? "展示极简"
                              : example.design.mode === "briefing"
                                ? "中性通报"
                                : "自定义"}
                    </div>
                  </div>
                  <button
                    onClick={() => onPick(example.design)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-purple-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 shadow-sm shadow-accent/20"
                  >
                    用此风格
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
