import { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Slide } from "@/types/deck";
import { useDeckStore } from "@/store/deck";
import { resolveTheme } from "@/themes";
import { DEFAULT_DESIGN } from "@/types/design";
import { SlideThumbnail } from "@/engine/preview";
import { useT } from "@/hooks/use-page-t";
import { IconButton } from "@/components/ui/icon-button";
import type { TranslationKey } from "@/services/i18n";

interface Props {
  slide: Slide;
  index: number;
  total: number;
  isSelected?: boolean;
  onSelect?: (index: number) => void;
  qualitySeverity?: "hard" | "soft";
}

/** 方向键移动选中时同步移动焦点，避免焦点与 listbox 选中态错位 */
function focusSiblingOption(current: HTMLElement, delta: number) {
  const siblings =
    current.parentElement?.querySelectorAll<HTMLElement>('[role="option"]');
  if (!siblings) return;
  const pos = Array.from(siblings).indexOf(current);
  siblings[pos + delta]?.focus();
}

const layoutLabels: Record<string, TranslationKey> = {
  cover: "inspector.layoutCover",
  section: "inspector.layoutSection",
  content: "inspector.layoutContent",
  "two-column": "inspector.layoutTwoColumn",
  chart: "inspector.layoutChart",
  image: "inspector.layoutImage",
  closing: "inspector.layoutClosing",
  "cols-2": "inspector.layoutCols2",
  "cols-3": "inspector.layoutCols3",
  "cols-4": "inspector.layoutCols4",
  "cols-5": "inspector.layoutCols5",
  "cols-6": "inspector.layoutCols6",
};

export const SortableSlideItem = memo(function SortableSlideItem({
  slide,
  index,
  total,
  isSelected,
  onSelect,
  qualitySeverity,
}: Props) {
  const t = useT();
  const palette = useDeckStore((s) => s.deck?.design.palette);
  const visualStyle = useDeckStore((s) => s.deck?.design.visualStyle);
  const canvasFormat = useDeckStore((s) => s.deck?.design.canvasFormat);
  const theme = resolveTheme(
    palette ?? DEFAULT_DESIGN.palette,
    visualStyle ?? DEFAULT_DESIGN.visualStyle,
  );
  const updateSlide = useDeckStore((s) => s.updateSlide);
  const removeSlide = useDeckStore((s) => s.removeSlide);
  const moveSlide = useDeckStore((s) => s.moveSlide);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      role="option"
      aria-selected={isSelected}
      aria-label={`${index + 1}. ${slide.title || t("editor.untitled")}`}
      tabIndex={0}
      onClick={() => onSelect?.(index)}
      onKeyDown={(e) => {
        // 只处理卡片本身的按键：避免抢占标题输入框与操作按钮
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(index);
        } else if (e.key === "ArrowUp" && index > 0) {
          e.preventDefault();
          onSelect?.(index - 1);
          focusSiblingOption(e.currentTarget, -1);
        } else if (e.key === "ArrowDown" && index < total - 1) {
          e.preventDefault();
          onSelect?.(index + 1);
          focusSiblingOption(e.currentTarget, 1);
        }
      }}
      className={`group relative cursor-pointer rounded-lg border transition-shadow focus-visible:ring-2 focus-visible:ring-accent/60 ${
        isSelected
          ? "border-accent bg-accent-soft/40"
          : isDragging
            ? "z-50 border-accent shadow-lg ring-2 ring-accent"
            : "border-border"
      } bg-bg-elevated hover:shadow-sm`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label={t("outline.dragHandle")}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:text-text-secondary group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="px-3 pb-3 pt-2">
        {/* 缩略图 */}
        <div className="mb-2 flex justify-center">
          <SlideThumbnail
            slide={slide}
            theme={theme}
            width={260}
            canvasFormat={canvasFormat}
          />
        </div>

        {/* 底部信息行 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">
            #{index + 1}
          </span>
          {qualitySeverity && (
            <span
              title={
                qualitySeverity === "hard"
                  ? t("outline.qHard")
                  : t("outline.qSoft")
              }
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                qualitySeverity === "hard" ? "bg-danger" : "bg-warning"
              }`}
            />
          )}
          <input
            value={slide.title}
            onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
            placeholder={t("outline.pageTitle")}
            className="min-w-0 flex-1 truncate bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />

          {/* 悬浮操作栏 */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
                  {t(label)}
                </option>
              ))}
            </select>

            <span className="mx-0.5 h-3 w-px bg-border" />

            <IconButton
              data-no-select="true"
              label={t("outline.moveUp")}
              onClick={(e) => {
                // 阻止冒泡，避免移动后父容器再把选中索引设回旧位置
                e.stopPropagation();
                if (index > 0) {
                  moveSlide(index, index - 1);
                  // 选中跟随被移动的页面，避免画布跳成相邻页
                  onSelect?.(index - 1);
                }
              }}
              disabled={index === 0}
              icon={<ChevronUp className="h-3.5 w-3.5" />}
            />
            <IconButton
              label={t("outline.moveDown")}
              onClick={(e) => {
                e.stopPropagation();
                if (index < total - 1) {
                  moveSlide(index, index + 1);
                  onSelect?.(index + 1);
                }
              }}
              disabled={index === total - 1}
              icon={<ChevronDown className="h-3.5 w-3.5" />}
            />

            <span className="mx-0.5 h-3 w-px bg-border" />

            <IconButton
              label={t("common.delete")}
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        {/* 删除两步确认（与图片删除一致的内联确认，避免误删） */}
        {confirmDelete && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-danger/10 px-2 py-1.5">
            <span className="text-[11px] text-danger">
              {t("outline.deleteSlideConfirm")}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSlide(slide.id);
                }}
                className="rounded bg-danger px-2 py-0.5 text-[11px] text-on-danger hover:bg-danger/90"
              >
                {t("common.confirm")}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
                className="rounded px-1.5 py-0.5 text-[11px] text-text-muted hover:text-text-primary"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
