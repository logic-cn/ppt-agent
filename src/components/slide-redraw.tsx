import { useState } from "react";
import { useDeckStore } from "@/store/deck";
import { useToastStore } from "@/store/toast";

interface SlideRedrawButtonProps {
  slideId: string;
  className?: string;
  /**
   * 该页 SVG 已过期（内容被编辑但未重画）。
   * 为 true 时按钮高亮并显示「重画同步」，引导用户点击。
   */
  stale?: boolean;
}

/**
 * 单页重画按钮：点击后调用 store 的 regenerateSlide 重新生成该页 SVG。
 * 显示 loading 态，失败仅 console.error，不阻塞 UI。
 */
export function SlideRedrawButton({
  slideId,
  className,
  stale,
}: SlideRedrawButtonProps) {
  const regenerateSlide = useDeckStore((s) => s.regenerateSlide);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await regenerateSlide(slideId);
    } catch (err) {
      useToastStore.getState().add({
        type: "error",
        title: "单页重画失败",
        message: err instanceof Error ? err.message : String(err),
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`rounded-md px-3 py-1 text-sm disabled:opacity-50 ${
        stale
          ? "bg-accent text-white hover:bg-accent-hover"
          : "text-text-secondary hover:bg-bg-hover"
      } ${className ?? ""}`}
    >
      {loading ? "重画中…" : stale ? "重画同步" : "重画此页"}
    </button>
  );
}
