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
import { useState } from "react";
import { useDeckStore } from "@/store/deck";
import { useToastStore } from "@/store/toast";
import { generateOutline } from "@/services/outline";
import type { Slide } from "@/types/deck";
import { Sparkles, Plus, Loader2, Send } from "lucide-react";
import { SortableSlideItem } from "./sortable-slide-item";

export function OutlineEditor() {
  const deck = useDeckStore((s) => s.deck);
  const moveSlide = useDeckStore((s) => s.moveSlide);
  const replaceSlides = useDeckStore((s) => s.replaceSlides);
  const addToast = useToastStore((s) => s.add);
  const [showInput, setShowInput] = useState(false);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (!deck) return null;

  const slides = deck.slides;
  const slideIds = slides.map((s) => s.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      moveSlide(oldIndex, newIndex);
    }
  };

  const handleGenerate = async () => {
    const t = topic.trim();
    if (!t) return;
    setGenerating(true);
    try {
      const result = await generateOutline({ topic: t });
      replaceSlides(result);
      addToast({ type: "success", title: `已生成 ${result.length} 页大纲` });
      setShowInput(false);
      setTopic("");
    } catch (e) {
      addToast({
        type: "error",
        title: "生成失败",
        message: (e as Error).message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const addSlide = () => {
    const lastLayout =
      slides.length > 1 ? slides[slides.length - 2].layout : "content";
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      layout: lastLayout,
      title: "",
    };
    const updated = [...slides, newSlide];
    replaceSlides(updated);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-text-muted">
        大纲
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInput(!showInput)}
            className="rounded p-1 hover:bg-bg-hover"
            title="AI 生成大纲"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          </button>
          <button
            onClick={addSlide}
            className="rounded p-1 hover:bg-bg-hover"
            title="添加页面"
          >
            <Plus className="h-3.5 w-3.5 text-text-secondary" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-2">
        {/* AI 主题输入栏 */}
        {showInput && (
          <div className="mb-3 rounded-md border border-accent bg-accent-soft/20 p-2">
            <p className="mb-1.5 text-xs text-text-secondary">
              输入 PPT 主题，AI 自动生成大纲
            </p>
            <div className="flex gap-1">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !generating) void handleGenerate();
                }}
                placeholder="如：Q3 业务复盘汇报"
                autoFocus
                className="min-w-0 flex-1 rounded border border-border bg-bg-base px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !topic.trim()}
                className="flex shrink-0 items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {slides.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted">
            点击 ✨ 按钮输入主题，让 AI 生成大纲
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
              <div className="space-y-1">
                {slides.map((slide, i) => (
                  <SortableSlideItem
                    key={slide.id}
                    slide={slide}
                    index={i}
                    total={slides.length}
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
