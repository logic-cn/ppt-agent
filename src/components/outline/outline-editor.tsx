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

interface OutlineEditorProps {
  onSelectSlide?: (index: number) => void;
  selectedIndex?: number;
}

const severityRank = { info: 1, warning: 2, error: 3 } as const;

export function OutlineEditor({
  onSelectSlide,
  selectedIndex,
}: OutlineEditorProps) {
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

  const severityBySlide = new Map<string, "error" | "warning" | "info">();
  if (qualityReport) {
    for (const issue of qualityReport.issues) {
      if (!issue.slideId) continue;
      const prev = severityBySlide.get(issue.slideId);
      if (!prev || severityRank[issue.severity] > severityRank[prev]) {
        severityBySlide.set(issue.slideId, issue.severity);
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      moveSlide(oldIndex, newIndex);
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
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        大纲
        <button
          onClick={addSlide}
          className="rounded-md p-1.5 hover:bg-bg-hover transition-colors"
          title="添加页面"
        >
          <Plus className="h-3.5 w-3.5 text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-3">
        {slides.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted">
            在右侧 AI 助手聊天框中输入主题生成大纲
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
