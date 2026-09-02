import { memo } from "react";
import { useT } from "@/hooks/use-page-t";

export type SvgViewerStatus = "loading" | "error" | "empty" | "ready";

interface SvgViewerProps {
  svg: string;
  className?: string;
  status?: SvgViewerStatus;
  errorMessage?: string;
}

function Placeholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      data-svg-viewer=""
      className={`relative flex w-full items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: "16 / 9", background: "#f5f5f5" }}
    >
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  );
}

/**
 * SvgViewer 原生渲染由我们自己的 LLM 管线生成的 SVG 字符串。
 *
 * 安全说明：此处使用 dangerouslySetInnerHTML。svg 来自内部 executor 管线，
 * 且已通过 spec-contract / quality checker 契约校验（viewBox 固定 0 0 1280 720，
 * 仅允许标准 SVG 元素），来源可信，不在不可信用户输入路径上，故可接受。
 */
export const SvgViewer = memo(function SvgViewer({
  svg,
  className,
  status,
  errorMessage,
}: SvgViewerProps) {
  const t = useT();
  const resolved = status ?? (svg ? ("ready" as const) : ("empty" as const));

  if (resolved === "loading") {
    return <Placeholder label={t("common.generating")} className={className} />;
  }
  if (resolved === "error") {
    return (
      <Placeholder
        label={errorMessage ?? t("common.error")}
        className={className}
      />
    );
  }
  if (resolved === "empty") {
    return <Placeholder label={t("common.empty")} className={className} />;
  }

  return (
    <div
      data-svg-viewer=""
      className={`relative w-full overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: "16 / 9", background: "#fff" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
