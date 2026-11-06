import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import type { Deck, Slide } from "@/types/deck";
import type { Theme } from "@/types/theme";
import { getCanvasFormat } from "@/types/canvas";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { RenderSlideViewer } from "@/engine/preview/render-slide-viewer";
import { SvgViewer } from "@/components/SvgViewer";
import { useT } from "@/hooks/use-page-t";

interface Props {
  deck: Deck;
  theme: Theme;
  initialIndex?: number;
  onExit: () => void;
}

export function PresentationMode({
  deck,
  theme,
  initialIndex = 0,
  onExit,
}: Props) {
  const t = useT();
  const [index, setIndex] = useState(initialIndex);
  const [showNotes, setShowNotes] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  const slides = deck.slides;
  const currentSlide: Slide | undefined = slides[index];
  const slideCount = slides.length;

  const renderSlides = useMemo(
    () => buildRenderSlides(deck, theme),
    [deck, theme],
  );
  const currentRenderSlide = renderSlides[index];

  // 画布格式决定放映宽高比（16:9 / 3:4 / 1:1），与导出端同源
  const canvas = getCanvasFormat(deck.design.canvasFormat);

  // 计算最佳缩放尺寸
  const padding = 48;
  const availW = size.w - padding * 2;
  const availH = size.h - padding * 2;
  const slideW = Math.min(availW, (availH * canvas.w) / canvas.h);
  const slideH = (slideW * canvas.h) / canvas.w;
  const aspect = `${canvas.w} / ${canvas.h}`;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(slideCount - 1, i + 1)),
    [slideCount],
  );

  // 键盘事件：放映是模态层，必须在捕获阶段独占按键。
  // 否则底层预览的 window 冒泡监听会先翻页并触发父组件重渲染，
  // 导致本监听在派发途中被清理/重挂，本次按键直接丢失（方向键失效）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let handled = true;
      if (e.key === "Escape") {
        onExit();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        goNext();
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((v) => !v);
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onExit, goPrev, goNext]);
  useEffect(() => {
    const onMove = () => {
      setShowBar(true);
      if (barTimer.current) clearTimeout(barTimer.current);
      barTimer.current = setTimeout(() => setShowBar(false), 3000);
    };
    window.addEventListener("mousemove", onMove);
    onMove();
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (barTimer.current) clearTimeout(barTimer.current);
    };
  }, []);

  // 窗口大小变化
  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{ cursor: "default" }}
    >
      {/* 幻灯片 */}
      {currentSlide ? (
        <div
          className="relative overflow-hidden rounded-xl shadow-2xl"
          style={{ width: slideW, height: slideH }}
        >
          {currentSlide.svg ? (
            <SvgViewer
              svg={currentSlide.svg}
              className="h-full w-full"
              aspect={aspect}
            />
          ) : (
            <RenderSlideViewer
              renderSlide={currentRenderSlide}
              slide={currentSlide}
              theme={theme}
              width={slideW}
            />
          )}
        </div>
      ) : (
        <div className="text-white/60">{t("present.empty")}</div>
      )}

      {/* 演讲者备注面板 */}
      {showNotes && currentSlide?.notes && (
        <div className="absolute bottom-20 left-1/2 z-10 max-h-[40vh] max-w-lg -translate-x-1/2 overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-4 text-sm text-white/90 backdrop-blur-md">
          <div className="mb-2 text-xs font-medium text-white/50">
            {t("present.notes")}
          </div>
          <div className="whitespace-pre-wrap">{currentSlide.notes}</div>
        </div>
      )}

      {/* 底部操作栏 - 自动隐藏 */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-4 px-6 py-4 transition-opacity duration-300 ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 rounded-full bg-black/60 px-5 py-2 backdrop-blur-md">
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            disabled={index === 0}
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="min-w-[60px] text-center text-sm text-white/80">
            {index + 1} / {slideCount}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            disabled={index === slideCount - 1}
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mx-2 h-4 w-px bg-white/20" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNotes((v) => !v);
            }}
            className={`rounded-full p-1.5 ${
              showNotes ? "text-accent" : "text-white/70 hover:text-white"
            }`}
            title={t("present.notesShortcut")}
          >
            <MessageSquareText className="h-4 w-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            title={t("present.exitShortcut")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 左右翻页热区（与点击分区一致：左右各 30%，hover 显示箭头） */}
      <button
        onClick={goPrev}
        disabled={index === 0}
        aria-label={t("preview.prevPage")}
        className="group absolute inset-y-0 left-0 z-0 flex w-[30%] items-center justify-start pl-4 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:cursor-default disabled:opacity-0"
      >
        <span className="rounded-full bg-white/10 p-2 text-white/50 backdrop-blur-sm group-hover:text-white/80">
          <ChevronLeft className="h-5 w-5" />
        </span>
      </button>
      <button
        onClick={goNext}
        disabled={index === slideCount - 1}
        aria-label={t("preview.nextPage")}
        className="group absolute inset-y-0 right-0 z-0 flex w-[30%] items-center justify-end pr-4 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:cursor-default disabled:opacity-0"
      >
        <span className="rounded-full bg-white/10 p-2 text-white/50 backdrop-blur-sm group-hover:text-white/80">
          <ChevronRight className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}
