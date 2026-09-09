import { memo, useState, useRef, useEffect, useMemo } from "react";
import { useT } from "@/hooks/use-page-t";
import type { ElementContext } from "./svg-editor-canvas";
import type { Deck, Slide } from "@/types/deck";
import { resolveTheme } from "@/themes";
import { DEFAULT_DESIGN } from "@/types/design";
import { buildRenderSlideCached } from "@/engine/render-ir/build";
import { getRendererMode } from "@/engine/renderer-config";
import { RenderSlideViewer } from "./render-slide-viewer";
import { SvgViewer } from "@/components/SvgViewer";
import { SlideRedrawButton } from "@/components/slide-redraw";
import { SvgEditorCanvas } from "./svg-editor-canvas";
import { Pencil } from "lucide-react";

interface Props {
  deck: Deck;
  className?: string;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  /** 预览原位编辑（E）：提供时可开启画布编辑模式 */
  onUpdateSlideSvg?: (slideId: string, svg: string) => void;
  /** V1.5 批注流：选中元素的 AI 定向修改 */
  onAnnotateElement?: (
    slideId: string,
    instruction: string,
    ctx: ElementContext,
  ) => void;
  /** 生成跟随：正在生成的页索引（非空时画布自动切到该页） */
  generatingIndex?: number | null;
}

export const SlidePreview = memo(function SlidePreview({
  deck,
  className,
  currentIndex: controlledIndex,
  onIndexChange,
  onUpdateSlideSvg,
  onAnnotateElement,
  generatingIndex,
}: Props) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const t = useT();
  const currentIndex = controlledIndex ?? internalIndex;
  const setCurrentIndex = onIndexChange ?? setInternalIndex;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(960);

  const theme = useMemo(
    () => resolveTheme(deck.design.palette, deck.design.visualStyle),
    [deck.design.palette, deck.design.visualStyle],
  );
  const slides = deck.slides;
  const currentSlide: Slide | undefined = slides[currentIndex];

  // feature flag：当前仅 render-ir 一种模式（旧渲染器已迁移移除）
  const rendererMode = getRendererMode();
  // 只构建当前页，避免任意一页变更都全量重建整本 deck 的 RenderIR
  const currentRenderSlide = useMemo(
    () =>
      currentSlide ? buildRenderSlideCached(currentSlide, deck, theme) : null,
    [currentSlide, theme, rendererMode],
  );

  // E3：生成期间自动跟随当前正在生成的页
  useEffect(() => {
    if (generatingIndex != null) setCurrentIndex(generatingIndex);
  }, [generatingIndex, setCurrentIndex]);

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
          {currentSlide.svg && onUpdateSlideSvg && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md px-2 py-1 text-xs backdrop-blur transition ${
                editMode
                  ? "bg-accent text-white"
                  : "bg-black/40 text-white/90 hover:bg-black/60"
              }`}
              title={editMode ? t("preview.exitEditMode") : t("preview.editMode")}
            >
              <Pencil className="h-3 w-3" />
              {editMode ? t("preview.exitEditMode") : t("preview.editMode")}
            </button>
          )}
          {currentSlide.svg ? (
            editMode && onUpdateSlideSvg ? (
              <SvgEditorCanvas
                svg={currentSlide.svg}
                onUpdate={(next) => onUpdateSlideSvg(currentSlide.id, next)}
                onAnnotate={
                  onAnnotateElement
                    ? (instruction, ctx) =>
                        onAnnotateElement(currentSlide.id, instruction, ctx)
                    : undefined
                }
                className="h-full w-full"
              />
            ) : (
              <SvgViewer svg={currentSlide.svg} className="h-full w-full" />
            )
          ) : (
            currentRenderSlide && (
              <RenderSlideViewer
                renderSlide={currentRenderSlide}
                slide={currentSlide}
                theme={theme}
                width={slideWidth}
              />
            )
          )}
          {/* SVG 已过期：内容被编辑但未重画，提示用户同步 */}
          {currentSlide.svg && currentSlide.svgStale && (
            <div
              role="status"
              className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-white shadow"
            >
              <span aria-hidden>⚠</span>
              内容已修改，预览为旧版本
            </div>
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
        {currentSlide.svg && (
          <SlideRedrawButton
            slideId={currentSlide.id}
            stale={currentSlide.svgStale}
          />
        )}
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
      design: { ...DEFAULT_DESIGN, palette: theme.id },
      slides: [slide],
      version: 2,
      createdAt: 0,
      updatedAt: 0,
    } as unknown as Deck;
    return buildRenderSlideCached(slide, dummyDeck, theme);
  }, [slide, theme]);

  return (
    <div
      className="relative overflow-hidden rounded-md ring-1 ring-black/10"
      style={{ width, height }}
    >
      {slide.svg ? (
        <SvgViewer svg={slide.svg} className="h-full w-full" />
      ) : (
        renderSlide && (
          <RenderSlideViewer
            renderSlide={renderSlide}
            slide={slide}
            theme={theme}
            width={width}
          />
        )
      )}
      {/* SVG 已过期的小角标 */}
      {slide.svg && slide.svgStale && (
        <div
          role="img"
          aria-label="内容已修改，预览为旧版本"
          className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] leading-none text-white"
        >
          <span aria-hidden>!</span>
        </div>
      )}
    </div>
  );
});
