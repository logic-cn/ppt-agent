import { useState, useRef, useEffect } from "react";
import type { Deck, Slide } from "@/types/deck";
import { resolveTheme } from "@/themes";
import { SlideRenderer } from "./slide-renderer";

interface Props {
  deck: Deck;
  className?: string;
}

export function SlidePreview({ deck, className }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(960);

  const theme = resolveTheme(deck.themeId, deck.themeOverrides);
  const slides = deck.slides;
  const currentSlide: Slide | undefined = slides[currentIndex];

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

  const slideWidth = Math.min(containerWidth - 64, 960);
  const slideHeight = (slideWidth * 9) / 16;

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () =>
    setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      {/* 预览画布 */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-8"
      >
        <div
          className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/10"
          style={{ width: slideWidth, height: slideHeight }}
        >
          <SlideRenderer
            slide={currentSlide}
            theme={theme}
            width={slideWidth}
          />
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
}

/** 缩略图模式，用于大纲面板 */
export function SlideThumbnail({
  slide,
  theme,
  width = 160,
}: {
  slide: Slide;
  theme: ReturnType<typeof resolveTheme>;
  width?: number;
}) {
  const height = (width * 9) / 16;
  return (
    <div
      className="relative overflow-hidden rounded-md ring-1 ring-black/10"
      style={{ width, height }}
    >
      <SlideRenderer slide={slide} theme={theme} width={width} />
    </div>
  );
}
