import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDeckStore } from "@/store/deck";
import { useQualityStore } from "@/store/quality";
import type { Slide } from "@/types/deck";
import { Plus } from "lucide-react";
import { SortableSlideItem } from "./sortable-slide-item";
import { useT } from "@/hooks/use-page-t";

interface OutlineEditorProps {
  onSelectSlide?: (index: number) => void;
  selectedIndex?: number;
}

const severityRank = { soft: 1, hard: 2 } as const;

export function OutlineEditor({
  onSelectSlide,
  selectedIndex,
}: OutlineEditorProps) {
  const t = useT();
  const deck = useDeckStore((s) => s.deck);
  const moveSlide = useDeckStore((s) => s.moveSlide);
  const replaceSlides = useDeckStore((s) => s.replaceSlides);
  const qualityReport = useQualityStore((s) => s.report);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (!deck) return null;

  const slides = deck.slides;
  const slideIds = slides.map((s) => s.id);

  const severityBySlide = new Map<string, "hard" | "soft">();
  if (qualityReport) {
    for (const finding of qualityReport) {
      if (!finding.slideId) continue;
      const prev = severityBySlide.get(finding.slideId);
      if (!prev || severityRank[finding.severity] > severityRank[prev]) {
        severityBySlide.set(finding.slideId, finding.severity);
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    moveSlide(oldIndex, newIndex);
    // 拖拽后按 id 重新定位选中页：排序不应让画布跳到另一页
    const selectedId = slides[selectedIndex ?? -1]?.id;
    if (selectedId && onSelectSlide) {
      const reordered = [...slides];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      const nextIndex = reordered.findIndex((s) => s.id === selectedId);
      if (nextIndex !== -1 && nextIndex !== selectedIndex) {
        onSelectSlide(nextIndex);
      }
    }
  };

  const addSlide = async () => {
    const lastSlide = slides[slides.length - 1];
    const lastLayout = lastSlide?.layout ?? "content";
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      layout: lastLayout,
      title: "",
    };
    const updated = [...slides, newSlide];
    await replaceSlides(updated);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-muted">
        {t("outline.title")}
        <button
          onClick={addSlide}
          className="rounded-md p-1.5 hover:bg-bg-hover transition-colors"
          title={t("outline.addSlide")}
        >
          <Plus className="h-3.5 w-3.5 text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-3">
        {slides.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted">
            {t("outline.empty")}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={slideIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {slides.map((slide, i) => (
                  <SortableSlideItem
                    key={slide.id}
                    slide={slide}
                    index={i}
                    total={slides.length}
                    isSelected={i === selectedIndex}
                    onSelect={onSelectSlide}
                    qualitySeverity={severityBySlide.get(slide.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
