import { memo } from "react";

interface SvgViewerProps {
  svg: string;
  className?: string;
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
}: SvgViewerProps) {
  return (
    <div
      data-svg-viewer=""
      className={`relative w-full overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: "16 / 9", background: "#fff" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
