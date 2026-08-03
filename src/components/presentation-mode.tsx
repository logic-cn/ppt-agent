import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import type { Deck, Slide } from "@/types/deck";
import type { Theme } from "@/types/theme";
import { buildRenderSlides } from "@/engine/render-ir/build";
import { RenderSlideViewer } from "@/engine/preview/render-slide-viewer";
import { SvgViewer } from "@/components/SvgViewer";

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
  const [index, setIndex] = useState(initialIndex);
  const [showNotes, setShowNotes] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // 计算最佳缩放尺寸
  const padding = 48;
  const availW = size.w - padding * 2;
  const availH = size.h - padding * 2;
  const slideW = Math.min(availW, (availH * 16) / 9);
  const slideH = (slideW * 9) / 16;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(slideCount - 1, i + 1)),
    [slideCount],
  );

  // 键盘事件
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "n" || e.key === "N") {
        setShowNotes((v) => !v);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, goPrev, goNext]);

  // 鼠标移动时显示操作栏，3s 后自动隐藏
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

  // 点击左右区域翻页
  const handleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const mid = rect.width * 0.3;
    if (x < mid) goPrev();
    else if (x > rect.width - mid) goNext();
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={handleClick}
      style={{ cursor: "default" }}
    >
      {/* 幻灯片 */}
      {currentSlide ? (
        <div
          className="relative overflow-hidden rounded-xl shadow-2xl"
          style={{ width: slideW, height: slideH }}
        >
          {currentSlide.svg ? (
            <SvgViewer svg={currentSlide.svg} className="h-full w-full" />
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
        <div className="text-white/60">暂无幻灯片</div>
      )}

      {/* 演讲者备注面板 */}
      {showNotes && currentSlide?.notes && (
        <div className="absolute bottom-20 left-1/2 z-10 max-w-lg -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 p-4 text-sm text-white/90 backdrop-blur-md">
          <div className="mb-2 text-xs font-medium text-white/50">
            演讲者备注
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
            title="备注 (N)"
          >
            <MessageSquareText className="h-4 w-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            title="退出 (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 左右翻页热区指示（hover 时显示） */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-0 flex w-[15%] items-center justify-start pl-4 opacity-0 transition-opacity hover:opacity-100">
        <div className="rounded-full bg-white/10 p-2 text-white/50 backdrop-blur-sm">
          <ChevronLeft className="h-5 w-5" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-0 flex w-[15%] items-center justify-end pr-4 opacity-0 transition-opacity hover:opacity-100">
        <div className="rounded-full bg-white/10 p-2 text-white/50 backdrop-blur-sm">
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
