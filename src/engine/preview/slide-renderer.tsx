import { memo } from "react";
import { ImageIcon } from "lucide-react";
import type { Slide, ChartSpec } from "@/types/deck";
import type { Theme } from "@/types/theme";
import {
  isColsLayout,
  getColCount,
  getColumnRects,
} from "@/engine/shared/layout";
import { rectToStyle } from "./utils";
import { BulletList } from "./bullet-list";

interface Props {
  slide: Slide;
  theme: Theme;
  /** 实际渲染宽度（px），用于字号缩放基准 */
  width: number;
  /** 生成配图回调，传入后会在空 visual 区域显示生成按钮 */
  onGenerateImage?: (slideId: string) => void;
}

export const SlideRenderer = memo(function SlideRenderer({
  slide,
  theme,
  width,
  onGenerateImage,
}: Props) {
  const layout = theme.layouts[slide.layout];
  if (!layout) return null;
  // preview 使用 px, PPTX 使用 pt; 1pt = 4/3px，统一基准后视觉比例一致
  const scale = (width / 1280) * (4 / 3);
  const isCols = isColsLayout(slide.layout);
  const colCount = isCols ? getColCount(slide.layout) : 0;

  // 渲染标题块
  const renderTitle = () => {
    if (!layout.title) return null;
    return (
      <div
        style={rectToStyle(layout.title)}
        className="flex flex-col justify-center"
      >
        <h1
          style={{
            fontSize: `${theme.fontSize.h1 * scale}px`,
            fontFamily: theme.fonts.title,
            color: theme.colors.primary,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p
            style={{
              fontSize: `${theme.fontSize.body * scale}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.textMuted,
              marginTop: `${8 * scale}px`,
              marginRight: 0,
              marginBottom: 0,
              marginLeft: 0,
            }}
          >
            {slide.subtitle}
          </p>
        )}
      </div>
    );
  };

  // 渲染正文（bullets 或 body markdown）
  const renderBody = () => {
    if (!layout.body) return null;
    return (
      <div style={rectToStyle(layout.body)}>
        {slide.bullets && slide.bullets.length > 0 ? (
          <BulletList bullets={slide.bullets} theme={theme} scale={scale} />
        ) : slide.body ? (
          <p
            style={{
              fontSize: `${theme.fontSize.body * scale}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {slide.body}
          </p>
        ) : null}
      </div>
    );
  };

  // 渲染多列 items
  const renderColumns = () => {
    if (!isCols || !slide.items || slide.items.length === 0) return null;
    if (!layout.body) return null;

    const colRects = getColumnRects(layout.body, colCount);
    const items = slide.items.slice(0, colCount);

    return (
      <>
        {items.map((item, i) => {
          const rect = colRects[i];
          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {item.title && (
                <h2
                  style={{
                    fontSize: `${(theme.fontSize.h2 - 2) * scale}px`,
                    fontFamily: theme.fonts.title,
                    color: theme.colors.primary,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: `${10 * scale}px`,
                    lineHeight: 1.3,
                    paddingBottom: `${8 * scale}px`,
                    borderBottom: `2px solid ${theme.colors.secondary}40`,
                  }}
                >
                  {item.title}
                </h2>
              )}
              <div style={{ flex: 1, overflow: "hidden" }}>
                {item.bullets && item.bullets.length > 0 ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {item.bullets.map((b, j) => (
                      <li
                        key={j}
                        style={{
                          fontSize: `${(theme.fontSize.body - 1) * scale}px`,
                          fontFamily: theme.fonts.body,
                          color: theme.colors.text,
                          lineHeight: 1.55,
                          marginBottom: `${6 * scale}px`,
                          paddingLeft: `${14 * scale}px`,
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: `${4 * scale}px`,
                            width: `${6 * scale}px`,
                            height: `${6 * scale}px`,
                            borderRadius: "50%",
                            background: theme.colors.accent,
                          }}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : item.body ? (
                  <p
                    style={{
                      fontSize: `${(theme.fontSize.body - 1) * scale}px`,
                      fontFamily: theme.fonts.body,
                      color: theme.colors.text,
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {item.body}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  // 渲染图表占位
  const renderChart = () => {
    if (!slide.chart || !layout.visual) return null;
    return (
      <div
        style={rectToStyle(layout.visual)}
        className="flex items-center justify-center"
      >
        <ChartPlaceholder chart={slide.chart} theme={theme} scale={scale} />
      </div>
    );
  };

  // 渲染图片区域
  const renderVisual = () => {
    if (!layout.visual) return null;
    if (slide.chart) return renderChart();
    if (slide.image) {
      return (
        <div
          style={rectToStyle(layout.visual)}
          className="flex items-center justify-center overflow-hidden rounded-lg"
        >
          {slide.image.url ? (
            <img
              src={slide.image.url}
              alt={slide.image.alt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-lg"
              style={{ background: theme.colors.surface }}
            >
              <span style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                {slide.image.prompt ?? "图片占位"}
              </span>
            </div>
          )}
        </div>
      );
    }
    if (onGenerateImage) {
      return (
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
      );
    }
    return null;
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: theme.colors.background }}
    >
      {/* 装饰色带 */}
      {(slide.layout === "cover" ||
        slide.layout === "section" ||
        slide.layout === "closing") && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${8 * scale}px`,
            background: theme.colors.primary,
          }}
        />
      )}

      {/* 内容页左侧装饰条 */}
      {slide.layout !== "cover" &&
        slide.layout !== "section" &&
        slide.layout !== "closing" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "10%",
              width: `${5 * scale}px`,
              height: "80%",
              background: theme.colors.primary,
              borderRadius: `0 ${3 * scale}px ${3 * scale}px 0`,
            }}
          />
        )}

      {renderTitle()}

      {isCols ? renderColumns() : renderBody()}

      {(slide.layout === "two-column" ||
        slide.layout === "chart" ||
        slide.layout === "image") &&
        renderVisual()}

      {slide.layout === "closing" && !slide.title && (
        <div
          style={{
            position: "absolute",
            bottom: `${40 * scale}px`,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: `${theme.fontSize.caption * scale}px`,
            color: theme.colors.textMuted,
          }}
        >
          感谢聆听
        </div>
      )}
    </div>
  );
});

const ChartPlaceholder = memo(function ChartPlaceholder({
  chart,
  theme,
  scale,
}: {
  chart: ChartSpec;
  theme: Theme;
  scale: number;
}) {
  const maxVal = Math.max(...chart.data.map((d) => d.value), 1);
  const total = chart.data.reduce((s, d) => s + d.value, 0);

  const renderBars = () => (
    <div
      className="flex flex-1 items-end justify-around"
      style={{ gap: `${8 * scale}px` }}
    >
      {chart.data.map((d, i) => (
        <div
          key={i}
          className="flex flex-1 flex-col items-center justify-end"
          style={{ height: "100%" }}
        >
          <span
            style={{
              fontSize: `${theme.fontSize.caption * scale}px`,
              color: theme.colors.text,
              marginBottom: `${4 * scale}px`,
            }}
          >
            {d.value}
          </span>
          <div
            style={{
              width: "60%",
              height: `${(d.value / maxVal) * 100}%`,
              background: theme.colors.accent,
              borderRadius: `${4 * scale}px ${4 * scale}px 0 0`,
              minHeight: `${4 * scale}px`,
            }}
          />
          <span
            style={{
              fontSize: `${theme.fontSize.caption * scale}px`,
              color: theme.colors.textMuted,
              marginTop: `${4 * scale}px`,
              textAlign: "center",
              wordBreak: "break-all",
            }}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );

  const renderLine = () => {
    const points = chart.data.map((d, i) => ({
      x: ((i + 0.5) / chart.data.length) * 100,
      y: (1 - d.value / maxVal) * 100,
      label: d.label,
      value: d.value,
    }));
    return (
      <div className="relative flex-1" style={{ margin: `${4 * scale}px 0` }}>
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={theme.colors.accent}
            strokeWidth="2"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2"
              fill={theme.colors.accent}
            />
          ))}
        </svg>
        <div className="flex justify-between px-1">
          {points.map((p, i) => (
            <span
              key={i}
              style={{
                fontSize: `${theme.fontSize.caption * scale * 0.8}px`,
                color: theme.colors.textMuted,
                textAlign: "center",
              }}
            >
              {p.value}
            </span>
          ))}
        </div>
        <div className="flex justify-between px-1">
          {points.map((p, i) => (
            <span
              key={i}
              style={{
                fontSize: `${theme.fontSize.caption * scale * 0.7}px`,
                color: theme.colors.textMuted,
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderPie = () => {
    if (total === 0) return null;
    let cumulative = 0;
    const segments = chart.data.map((d, i) => {
      const start = cumulative;
      cumulative += d.value;
      return {
        key: i,
        label: d.label,
        value: d.value,
        percent: (d.value / total) * 100,
        start,
        end: cumulative,
        color: [
          theme.colors.accent,
          theme.colors.secondary,
          theme.colors.primary,
          theme.colors.textMuted,
          "#94A3B8",
          "#CBD5E1",
        ][i % 6],
      };
    });

    const cx = 50;
    const cy = 50;
    const r = 35;

    const paths = segments.map((seg) => {
      const startAngle = (seg.start / total) * 360 - 90;
      const endAngle = (seg.end / total) * 360 - 90;
      const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
      const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
      const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
      const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
      const largeArc = seg.value / total > 0.5 ? 1 : 0;
      const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
      return <path key={seg.key} d={d} fill={seg.color} />;
    });

    return (
      <div className="flex flex-1 items-center justify-center gap-4">
        <svg viewBox="0 0 100 100" className="h-2/3 w-1/2">
          {paths}
        </svg>
        <div className="flex flex-col gap-1">
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2">
              <div
                style={{
                  width: `${8 * scale}px`,
                  height: `${8 * scale}px`,
                  background: seg.color,
                  borderRadius: "50%",
                }}
              />
              <span
                style={{
                  fontSize: `${theme.fontSize.caption * scale}px`,
                  color: theme.colors.text,
                }}
              >
                {seg.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        padding: `${12 * scale}px`,
        background: theme.colors.surface,
        borderRadius: `${8 * scale}px`,
      }}
    >
      {chart.title && (
        <p
          style={{
            fontSize: `${theme.fontSize.h2 * scale * 0.7}px`,
            color: theme.colors.primary,
            fontWeight: 600,
            marginBottom: `${12 * scale}px`,
          }}
        >
          {chart.title}
        </p>
      )}
      {chart.type === "line"
        ? renderLine()
        : chart.type === "pie" || chart.type === "doughnut"
          ? renderPie()
          : renderBars()}
    </div>
  );
});
