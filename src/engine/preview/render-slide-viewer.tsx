import { memo } from "react";
import { ImageIcon } from "lucide-react";
import type { RenderSlide, RenderNode, RenderTextNode, Rect } from "@/engine/render-ir/types";
import type { Theme } from "@/types/theme";
import type { Slide } from "@/types/deck";

interface Props {
  renderSlide: RenderSlide;
  slide: Slide;
  theme: Theme;
  width: number;
  onGenerateImage?: (slideId: string) => void;
}

function rectToStyle(rect: Rect) {
  return {
    position: "absolute" as const,
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}

export const RenderSlideViewer = memo(function RenderSlideViewer({
  renderSlide,
  slide,
  theme,
  width,
  onGenerateImage,
}: Props) {
  if (!renderSlide) return null;
  const hasVisual = slide.layout === "two-column" || slide.layout === "chart" || slide.layout === "image";
  const hasImageOrChart = renderSlide.nodes.some((n) => n.type === "image" || n.type === "chart");
  const layout = theme.layouts[slide.layout];

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: renderSlide.background }}
    >
      {renderSlide.nodes.map((node) => (
        <NodeViewer key={node.id} node={node} theme={theme} width={width} />
      ))}

      {hasVisual && !hasImageOrChart && layout?.visual && onGenerateImage && (
        <div
          style={rectToStyle(layout.visual)}
          className="flex items-center justify-center"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateImage(slide.id);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-dashed px-4 py-2 text-sm transition hover:border-accent hover:bg-white/5"
            style={{
              borderColor: `${theme.colors.textMuted}40`,
              color: theme.colors.textMuted,
            }}
          >
            <ImageIcon className="h-4 w-4" />
            AI 生成配图
          </button>
        </div>
      )}

      {slide.layout === "closing" && !slide.title && (
        <div
          style={{
            position: "absolute",
            bottom: `${(40 / 1280) * width}px`,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: `${(theme.fontSize.caption * width) / 1280}px`,
            color: theme.colors.textMuted,
          }}
        >
          感谢聆听
        </div>
      )}
    </div>
  );
});

// ---- Node dispatcher ----

const NodeViewer = memo(function NodeViewer({
  node,
  theme,
  width,
}: {
  node: RenderNode;
  theme: Theme;
  width: number;
}) {
  switch (node.type) {
    case "text":
      return <TextNodeViewer node={node} width={width} />;
    case "shape":
      return <ShapeNodeViewer node={node} width={width} />;
    case "image":
      return <ImageNodeViewer node={node} width={width} />;
    case "chart":
      return <ChartNodeViewer node={node} theme={theme} width={width} />;
    default:
      return null;
  }
});

// ---- Text node ----

const TextNodeViewer = memo(function TextNodeViewer({
  node,
  width,
}: {
  node: RenderTextNode;
  width: number;
}) {
  const { rect, text, style } = node;
  const sz = (px: number) => `${(px * width) / 1280}px`;

  const isBullet = typeof text === "string" && text.includes("•");
  const lines = isBullet ? text.split("\n") : null;

  return (
    <div
      style={{
        ...rectToStyle(rect),
        fontSize: sz(style.fontSize),
        fontFamily: style.fontFamily,
        fontWeight: style.bold ? 700 : 400,
        color: style.color,
        fontStyle: style.italic ? "italic" : "normal",
        textAlign: style.align ?? "left",
        lineHeight: 1.4,
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        display: "flex",
        flexDirection: "column",
        justifyContent: style.align === "center" ? "center" : "flex-start",
      }}
    >
      {lines
        ? lines.map((line, i) => (
            <span
              key={i}
              style={{
                fontSize: sz(line.trim().startsWith("•") ? style.fontSize : style.fontSize + 2),
                fontWeight: line.trim().startsWith("•") ? 400 : 600,
                color: style.color,
                paddingLeft: `${(line.search(/\S/)) * 6}px`,
                marginBottom: `${(4 * width) / 1280}px`,
              }}
            >
              {line.trim()}
            </span>
          ))
        : <span>{text as string}</span>}
    </div>
  );
});

// ---- Shape node ----

const ShapeNodeViewer = memo(function ShapeNodeViewer({
  node,
  width,
}: {
  node: Extract<RenderNode, { type: "shape" }>;
  width: number;
}) {
  if (node.shape === "line") {
    return (
      <div
        style={{
          ...rectToStyle(node.rect),
          borderTop: `2px solid ${node.stroke ?? "#ccc"}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...rectToStyle(node.rect),
        background: node.fill,
        borderRadius: node.radius ? `${(node.radius * width)}px` : undefined,
      }}
    />
  );
});

// ---- Image node ----

const ImageNodeViewer = memo(function ImageNodeViewer({
  node,
  width,
}: {
  node: Extract<RenderNode, { type: "image" }>;
  width: number;
}) {
  if (!node.src) {
    return (
      <div
        style={{
          ...rectToStyle(node.rect),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f4f6",
          borderRadius: `${(8 * width) / 1280}px`,
          fontSize: `${(14 * width) / 1280}px`,
          color: "#9ca3af",
        }}
      >
        图片占位
      </div>
    );
  }
  return (
    <div style={{ ...rectToStyle(node.rect), overflow: "hidden", borderRadius: `${(8 * width) / 1280}px` }}>
      <img
        src={node.src}
        alt={node.alt}
        className="h-full w-full"
        style={{ objectFit: node.fit ?? "cover" }}
      />
    </div>
  );
});

// ---- Chart node ----

const ChartNodeViewer = memo(function ChartNodeViewer({
  node,
  theme,
  width,
}: {
  node: Extract<RenderNode, { type: "chart" }>;
  theme: Theme;
  width: number;
}) {
  const s = (px: number) => `${(px * width) / 1280}px`;
  const chart = node.chart;
  const maxVal = Math.max(...chart.data.map((d) => d.value), 1);
  const colors = node.style.colors ?? [theme.colors.accent, theme.colors.secondary, theme.colors.primary];

  return (
    <div
      style={{
        ...rectToStyle(node.rect),
        display: "flex",
        flexDirection: "column",
        padding: s(12),
        background: theme.colors.surface,
        borderRadius: s(8),
      }}
    >
      {chart.title && (
        <p style={{ fontSize: s(theme.fontSize.h2 * 0.7), color: theme.colors.primary, fontWeight: 600, marginBottom: s(12) }}>
          {chart.title}
        </p>
      )}
      {chart.type === "pie" || chart.type === "doughnut" ? (
        <PieView chart={chart} colors={colors} s={s} />
      ) : chart.type === "line" ? (
        <LineView chart={chart} maxVal={maxVal} s={s} />
      ) : (
        <BarView chart={chart} maxVal={maxVal} theme={theme} s={s} />
      )}
    </div>
  );
});

const BarView = memo(function BarView({
  chart, maxVal, theme, s,
}: {
  chart: Extract<RenderNode, { type: "chart" }>["chart"];
  maxVal: number;
  theme: Theme;
  s: (px: number) => string;
}) {
  return (
    <div className="flex flex-1 items-end justify-around" style={{ gap: s(8) }}>
      {chart.data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
          <span style={{ fontSize: s(theme.fontSize.caption), color: theme.colors.text, marginBottom: s(4) }}>{d.value}</span>
          <div style={{
            width: "60%",
            height: `${(d.value / maxVal) * 100}%`,
            background: theme.colors.accent,
            borderRadius: `${s(4)} ${s(4)} 0 0`,
            minHeight: s(4),
          }} />
          <span style={{ fontSize: s(theme.fontSize.caption), color: theme.colors.textMuted, marginTop: s(4), textAlign: "center" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
});

const LineView = memo(function LineView({
  chart, maxVal, s,
}: {
  chart: Extract<RenderNode, { type: "chart" }>["chart"];
  maxVal: number;
  s: (px: number) => string;
}) {
  const points = chart.data.map((d, i) => ({
    x: ((i + 0.5) / chart.data.length) * 100,
    y: (1 - d.value / maxVal) * 100,
    value: d.value,
  }));
  return (
    <div className="relative flex-1" style={{ margin: `${s(4)} 0` }}>
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth="2" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#f59e0b" />)}
      </svg>
      <div className="flex justify-between px-1">
        {points.map((p, i) => <span key={i} style={{ fontSize: s(10), color: "#6b7280", textAlign: "center" }}>{p.value}</span>)}
      </div>
      <div className="flex justify-between px-1">
        {chart.data.map((d, i) => <span key={i} style={{ fontSize: s(9), color: "#9ca3af", textAlign: "center" }}>{d.label}</span>)}
      </div>
    </div>
  );
});

const PieView = memo(function PieView({
  chart, colors, s,
}: {
  chart: Extract<RenderNode, { type: "chart" }>["chart"];
  colors: string[];
  s: (px: number) => string;
}) {
  const total = chart.data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  let cumulative = 0;
  const cx = 50, cy = 50, r = 35;
  const paths = chart.data.map((d, i) => {
    const start = cumulative;
    cumulative += d.value;
    const startAngle = (start / total) * 360 - 90;
    const endAngle = (cumulative / total) * 360 - 90;
    const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
    const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
    const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
    const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = d.value / total > 0.5 ? 1 : 0;
    const dPath = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    return <path key={i} d={dPath} fill={colors[i % colors.length]} />;
  });
  return (
    <div className="flex flex-1 items-center justify-center gap-4">
      <svg viewBox="0 0 100 100" className="h-2/3 w-1/2">{paths}</svg>
      <div className="flex flex-col gap-1">
        {chart.data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: s(8), height: s(8), background: colors[i % colors.length], borderRadius: "50%" }} />
            <span style={{ fontSize: s(12), color: "#111827" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
