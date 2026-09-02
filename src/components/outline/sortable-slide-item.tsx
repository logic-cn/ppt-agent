import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Slide } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { resolveTheme } from "@/themes";
import { DEFAULT_DESIGN } from "@/types/design";
import { SlideThumbnail } from "@/engine/preview";

interface Props {
  slide: Slide;
  index: number;
  total: number;
  isSelected?: boolean;
  onSelect?: (index: number) => void;
  qualitySeverity?: "hard" | "soft";
}

const layoutLabels: Record<string, string> = {
  cover: "封面",
  section: "章节",
  content: "正文",
  "two-column": "双栏",
  chart: "图表",
  image: "配图",
  closing: "结尾",
  "cols-2": "2列",
  "cols-3": "3列",
  "cols-4": "4列",
  "cols-5": "5列",
  "cols-6": "6列",
};

export const SortableSlideItem = memo(function SortableSlideItem({
  slide,
  index,
  total,
  isSelected,
  onSelect,
  qualitySeverity,
}: Props) {
  const palette = useDeckStore((s) => s.deck?.design.palette);
  const visualStyle = useDeckStore((s) => s.deck?.design.visualStyle);
  const theme = resolveTheme(
    palette ?? DEFAULT_DESIGN.palette,
    visualStyle ?? DEFAULT_DESIGN.visualStyle,
  );
  const updateSlide = useDeckStore((s) => s.updateSlide);
  const removeSlide = useDeckStore((s) => s.removeSlide);
  const moveSlide = useDeckStore((s) => s.moveSlide);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect?.(index)}
      className={`group relative cursor-pointer rounded-lg border ${
        isSelected
          ? "border-accent bg-accent-soft/40"
          : isDragging
            ? "border-accent"
            : "border-border"
      } bg-bg-elevated transition-shadow hover:shadow-sm`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:text-text-secondary group-hover:opacity-100"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="px-3 pb-3 pt-2">
        {/* 缩略图 */}
        <div className="mb-2 flex justify-center">
          <SlideThumbnail slide={slide} theme={theme} width={260} />
        </div>

        {/* 底部信息行 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">
            #{index + 1}
          </span>
          {qualitySeverity && (
            <span
              title={
                qualitySeverity === "hard" ? "存在严重质量问题" : "存在提示"
              }
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                qualitySeverity === "hard" ? "bg-danger" : "bg-warning"
              }`}
            />
          )}
          <input
            value={slide.title}
            onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
            placeholder="页面标题"
            className="min-w-0 flex-1 truncate bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />

          {/* 悬浮操作栏 */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <select
              value={slide.layout}
              onChange={(e) =>
                updateSlide(slide.id, {
                  layout: e.target.value as Slide["layout"],
                })
              }
              className="rounded border border-border bg-bg-elevated px-1.5 py-0.5 text-[11px] text-text-secondary focus:border-accent focus:outline-none"
            >
              {Object.entries(layoutLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            <span className="mx-0.5 h-3 w-px bg-border" />

            <button
              onClick={() => index > 0 && moveSlide(index, index - 1)}
              disabled={index === 0}
              className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text-primary disabled:opacity-20"
              title="上移"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => index < total - 1 && moveSlide(index, index + 1)}
              disabled={index === total - 1}
              className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text-primary disabled:opacity-20"
              title="下移"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            <span className="mx-0.5 h-3 w-px bg-border" />

            <button
              onClick={() => removeSlide(slide.id)}
              className="rounded p-0.5 text-text-muted hover:bg-danger/10 hover:text-danger"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
