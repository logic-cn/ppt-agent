import { memo, useState, useRef, useEffect, useMemo } from "react";
import type { Deck, Slide } from "@/types/deck";
import { resolveTheme } from "@/themes";
import { buildRenderSlide } from "@/engine/render-ir/build";
import { getRendererMode } from "@/engine/renderer-config";
import { RenderSlideViewer } from "./render-slide-viewer";

interface Props {
  deck: Deck;
  className?: string;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onGenerateImage?: (slideId: string) => void;
}

export const SlidePreview = memo(function SlidePreview({
  deck,
  className,
  currentIndex: controlledIndex,
  onIndexChange,
  onGenerateImage,
}: Props) {
  const [internalIndex, setInternalIndex] = useState(0);
  const currentIndex = controlledIndex ?? internalIndex;
  const setCurrentIndex = onIndexChange ?? setInternalIndex;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(960);

  const theme = useMemo(
    () => resolveTheme(deck.themeId, deck.themeOverrides),
    [deck.themeId, deck.themeOverrides],
  );
  const slides = deck.slides;
  const currentSlide: Slide | undefined = slides[currentIndex];

  // feature flag：当前仅 render-ir 一种模式（旧渲染器已迁移移除）
  const rendererMode = getRendererMode();
  // 只构建当前页，避免任意一页变更都全量重建整本 deck 的 RenderIR
  const currentRenderSlide = useMemo(
    () => (currentSlide ? buildRenderSlide(currentSlide, deck, theme) : null),
    [currentSlide, theme, rendererMode],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!currentSlide) {
    return (
      <div
        className={`flex items-center justify-center text-text-muted ${className ?? ""}`}
      >
        暂无幻灯片
      </div>
    );
  }

  const slideWidth = Math.min(containerWidth - 32, 960);
  const slideHeight = (slideWidth * 9) / 16;

  const goPrev = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const goNext = () =>
    setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1));

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      {/* 预览画布 */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-4"
      >
        <div
          className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/10"
          style={{ width: slideWidth, height: slideHeight }}
        >
          {currentRenderSlide && (
            <RenderSlideViewer
              renderSlide={currentRenderSlide}
              slide={currentSlide}
              theme={theme}
              width={slideWidth}
              onGenerateImage={onGenerateImage}
            />
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-center gap-3 border-t border-border bg-bg-surface px-4 py-2">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="rounded-md px-3 py-1 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-30"
        >
          上一页
        </button>
        <span className="min-w-[60px] text-center text-sm text-text-muted">
          {currentIndex + 1} / {slides.length}
        </span>
        <button
          onClick={goNext}
          disabled={currentIndex === slides.length - 1}
          className="rounded-md px-3 py-1 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-30"
        >
          下一页
        </button>
      </div>
    </div>
  );
});

/** 缩略图模式，用于大纲面板 */
export const SlideThumbnail = memo(function SlideThumbnail({
  slide,
  theme,
  width = 160,
}: {
  slide: Slide;
  theme: ReturnType<typeof resolveTheme>;
  width?: number;
}) {
  const height = (width * 9) / 16;

  const renderSlide = useMemo(() => {
    const dummyDeck = {
      id: "thumb",
      title: slide.title,
      themeId: theme.id,
      slides: [slide],
      version: 2,
      createdAt: 0,
      updatedAt: 0,
    } as unknown as Deck;
    return buildRenderSlide(slide, dummyDeck, theme);
  }, [slide, theme]);

  return (
    <div
      className="relative overflow-hidden rounded-md ring-1 ring-black/10"
      style={{ width, height }}
    >
      <RenderSlideViewer
        renderSlide={renderSlide}
        slide={slide}
        theme={theme}
        width={width}
      />
    </div>
  );
});
