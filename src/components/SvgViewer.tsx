import { memo } from "react";
import { useT } from "@/hooks/use-page-t";

export type SvgViewerStatus = "loading" | "error" | "empty" | "ready";

interface SvgViewerProps {
  svg: string;
  className?: string;
  status?: SvgViewerStatus;
  errorMessage?: string;
  /** 画布宽高比（CSS aspect-ratio 值），随 deck.canvasFormat 传入；缺省 16:9 */
  aspect?: string;
}

function Placeholder({
  label,
  className,
  aspect,
}: {
  label: string;
  className?: string;
  aspect: string;
}) {
  return (
    <div
      data-svg-viewer=""
      className={`relative flex w-full items-center justify-center overflow-hidden bg-bg-surface ${className ?? ""}`}
      style={{ aspectRatio: aspect }}
    >
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

/**
 * SvgViewer 原生渲染由我们自己的 LLM 管线生成的 SVG 字符串。
 *
 * 安全说明：此处使用 dangerouslySetInnerHTML。svg 来自内部 executor 管线，
 * 且已通过 spec-contract / quality checker 契约校验（viewBox 固定为画布格式
 * 注册的像素尺寸，仅允许标准 SVG 元素），来源可信，不在不可信用户输入路径上，故可接受。
 */
export const SvgViewer = memo(function SvgViewer({
  svg,
  className,
  status,
  errorMessage,
  aspect = "16 / 9",
}: SvgViewerProps) {
  const t = useT();
  const resolved = status ?? (svg ? ("ready" as const) : ("empty" as const));

  if (resolved === "loading") {
    return (
      <Placeholder
        label={t("common.generating")}
        className={className}
        aspect={aspect}
      />
    );
  }
  if (resolved === "error") {
    return (
      <Placeholder
        label={errorMessage ?? t("common.error")}
        className={className}
        aspect={aspect}
      />
    );
  }
  if (resolved === "empty") {
    return (
      <Placeholder
        label={t("common.empty")}
        className={className}
        aspect={aspect}
      />
    );
  }

  return (
    <div
      data-svg-viewer=""
      className={`relative w-full overflow-hidden ${className ?? ""}`}
      // 幻灯片画布底色恒为白：SVG 本身自带画布底，容器仅兜底透明缝隙
      style={{ aspectRatio: aspect, background: "#fff" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
