import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Slide } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { getTheme } from "@/themes";
import { SlideThumbnail } from "@/engine/preview";
import { useState } from "react";

interface Props {
  slide: Slide;
  index: number;
  total: number;
}

export function SortableSlideItem({ slide, index, total }: Props) {
  const [expanded, setExpanded] = useState(false);
  const theme = getTheme(
    useDeckStore.getState().deck?.themeId ?? "business-blue",
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

  const layoutLabels: Record<string, string> = {
    cover: "封面",
    section: "章节",
    content: "正文",
    "two-column": "双栏",
    chart: "图表",
    image: "配图",
    closing: "结尾",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border ${isDragging ? "border-accent" : "border-border"} bg-bg-surface`}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-text-muted hover:text-text-secondary"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="mr-1 text-xs font-medium text-text-muted">
          {index + 1}
        </span>
        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
          {layoutLabels[slide.layout] ?? slide.layout}
        </span>
        <input
          value={slide.title}
          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
          placeholder="页面标题"
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded p-0.5 text-text-muted hover:bg-bg-hover"
        >
          <ChevronUp
            className={`h-3 w-3 transition ${expanded ? "" : "rotate-180"}`}
          />
        </button>
      </div>

      {/* 展开：缩略图 + 布局选择 + 操作 */}
      {expanded && (
        <div className="border-t border-border px-3 pb-2 pt-2">
          <SlideThumbnail slide={slide} theme={theme} width={200} />

          <div className="mt-2 flex items-center gap-2">
            <select
              value={slide.layout}
              onChange={(e) =>
                updateSlide(slide.id, {
                  layout: e.target.value as Slide["layout"],
                })
              }
              className="flex-1 rounded border border-border bg-bg-base px-2 py-1 text-xs focus:border-accent focus:outline-none"
            >
              {Object.entries(layoutLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            <div className="flex gap-1">
              {index > 0 && (
                <button
                  onClick={() => moveSlide(index, index - 1)}
                  className="rounded p-1 text-text-muted hover:bg-bg-hover"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
              {index < total - 1 && (
                <button
                  onClick={() => moveSlide(index, index + 1)}
                  className="rounded p-1 text-text-muted hover:bg-bg-hover"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => removeSlide(slide.id)}
              className="rounded p-1 text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
