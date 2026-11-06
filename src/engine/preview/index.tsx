import { memo, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useT } from "@/hooks/use-page-t";
import type { ElementContext } from "./svg-editor-canvas";
import type { Deck, Slide } from "@/types/deck";
import { resolveTheme } from "@/themes";
import { DEFAULT_DESIGN } from "@/types/design";
import { getCanvasFormat } from "@/types/canvas";
import { buildRenderSlideCached } from "@/engine/render-ir/build";
import { getRendererMode } from "@/engine/renderer-config";
import { RenderSlideViewer } from "./render-slide-viewer";
import { SvgViewer } from "@/components/SvgViewer";
import { SlideRedrawButton } from "@/components/slide-redraw";
import { SvgEditorCanvas } from "./svg-editor-canvas";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [containerSize, setContainerSize] = useState({ w: 960, h: 540 });

  const theme = useMemo(
    () => resolveTheme(deck.design.palette, deck.design.visualStyle),
    [deck.design.palette, deck.design.visualStyle],
  );
  const slides = deck.slides;
  const currentSlide: Slide | undefined = slides[currentIndex];

  // 画布格式决定预览宽高比（16:9 / 3:4 / 1:1），与导出端同源
  const canvas = getCanvasFormat(deck.design.canvasFormat);
  const aspect = `${canvas.w} / ${canvas.h}`;

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

  // 画布尺寸自适应：挂载即同步测量 + 短窗口收敛轮询（部分嵌入式/节流
  // WebView 布局惰性且 RO/rAF/resize 不派发，单次测量可能拿到未布局的
  // padding 盒）；RO + window resize 双通道跟进常规环境的变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerSize((prev) =>
          prev.w === rect.width && prev.h === rect.height
            ? prev
            : { w: rect.width, h: rect.height },
        );
      }
    };
    measure();
    let ticks = 0;
    const settleTimer = setInterval(() => {
      measure();
      if (++ticks >= 20) clearInterval(settleTimer);
    }, 100);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(settleTimer);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (!currentSlide) {
    return (
      <div
        className={`flex items-center justify-center text-text-muted ${className ?? ""}`}
      >
        {t("present.empty")}
      </div>
    );
  }

  // 竖版/方形画布按高度收口，避免内容溢出预览区（横向纵向都留 p-4 边距）
  const padding = 32;
  const availW = containerSize.w - padding;
  const availH = containerSize.h - padding;
  const slideWidth = Math.floor(
    Math.min(availW, (availH * canvas.w) / canvas.h, 960),
  );
  const slideHeight = (slideWidth * canvas.h) / canvas.w;

  const goPrev = useCallback(
    () => setCurrentIndex(Math.max(0, currentIndex - 1)),
    [currentIndex, setCurrentIndex],
  );
  const goNext = useCallback(
    () => setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1)),
    [slides.length, currentIndex, setCurrentIndex],
  );

  // 方向键翻页（输入框内不劫持按键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      {/* 预览画布 */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-4"
      >
        <div
          className="relative shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
          style={{ width: slideWidth, height: slideHeight }}
        >
          {currentSlide.svg && onUpdateSlideSvg && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md px-2 py-1 text-xs backdrop-blur transition ${
                editMode
                  ? "bg-accent text-on-accent"
                  : "bg-black/40 text-white/90 hover:bg-black/60"
              }`}
              title={
                editMode ? t("preview.exitEditMode") : t("preview.editMode")
              }
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
              <SvgViewer
                svg={currentSlide.svg}
                className="h-full w-full"
                aspect={aspect}
              />
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
              className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-warning px-3 py-1 text-xs font-medium text-on-warning shadow"
            >
              <span aria-hidden>⚠</span>
              {t("preview.staleBadge")}
            </div>
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-center gap-3 border-t border-border bg-bg-surface px-4 py-2">
        <Button variant="ghost" onClick={goPrev} disabled={currentIndex === 0}>
          {t("preview.prevPage")}
        </Button>
        <span className="min-w-[60px] text-center text-sm text-text-muted">
          {currentIndex + 1} / {slides.length}
        </span>
        <Button
          variant="ghost"
          onClick={goNext}
          disabled={currentIndex === slides.length - 1}
        >
          {t("preview.nextPage")}
        </Button>
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
  canvasFormat,
}: {
  slide: Slide;
  theme: ReturnType<typeof resolveTheme>;
  width?: number;
  /** 画布格式 id；缺省 16:9（历史 deck 兼容） */
  canvasFormat?: string;
}) {
  const t = useT();
  const canvas = getCanvasFormat(canvasFormat);
  const height = (width * canvas.h) / canvas.w;
  const aspect = `${canvas.w} / ${canvas.h}`;

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
      className="relative overflow-hidden rounded-md ring-1 ring-border"
      style={{ width, height }}
    >
      {slide.svg ? (
        <SvgViewer svg={slide.svg} className="h-full w-full" aspect={aspect} />
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
          aria-label={t("preview.staleBadge")}
          className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] leading-none text-on-warning"
        >
          <span aria-hidden>!</span>
        </div>
      )}
    </div>
  );
});
