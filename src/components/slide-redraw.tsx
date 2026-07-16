import { useState } from "react";
import { useDeckStore } from "@/store/deck";

interface SlideRedrawButtonProps {
  slideId: string;
  className?: string;
}

/**
 * 单页重画按钮：点击后调用 store 的 regenerateSlide 重新生成该页 SVG。
 * 显示 loading 态，失败仅 console.error，不阻塞 UI。
 */
export function SlideRedrawButton({
  slideId,
  className,
}: SlideRedrawButtonProps) {
  const regenerateSlide = useDeckStore((s) => s.regenerateSlide);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await regenerateSlide(slideId);
    } catch (err) {
      console.error("单页重画失败:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`rounded-md px-3 py-1 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50 ${
        className ?? ""
      }`}
    >
      {loading ? "重画中…" : "重画此页"}
    </button>
  );
}
