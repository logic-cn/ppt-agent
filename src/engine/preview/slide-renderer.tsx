import type { Slide, ChartSpec } from "@/types/deck";
import type { Theme } from "@/types/theme";
import { rectToStyle } from "./utils";
import { BulletList } from "./bullet-list";

interface Props {
  slide: Slide;
  theme: Theme;
  /** 实际渲染宽度（px），用于字号缩放基准 */
  width: number;
}

export function SlideRenderer({ slide, theme, width }: Props) {
  const layout = theme.layouts[slide.layout];
  const scale = width / 1280; // 基准设计宽度 1280px

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
              margin: 0,
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
      <div style={rectToStyle(layout.body)} className="overflow-hidden">
        {slide.bullets && slide.bullets.length > 0 ? (
          <BulletList bullets={slide.bullets} theme={theme} />
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

  // 渲染图表占位（M9 接入 chart.js）
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
    return null;
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: theme.colors.background }}
    >
      {/* 装饰：cover/section/closing 带顶部色带 */}
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

      {/* cover 布局：左色块装饰 */}
      {slide.layout === "cover" && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "30%",
            background: theme.colors.surface,
          }}
        />
      )}

      {renderTitle()}
      {renderBody()}

      {(slide.layout === "two-column" ||
        slide.layout === "chart" ||
        slide.layout === "image") &&
        renderVisual()}

      {/* closing 布局：居中 */}
      {slide.layout === "closing" && (
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
}

function ChartPlaceholder({
  chart,
  theme,
  scale,
}: {
  chart: ChartSpec;
  theme: Theme;
  scale: number;
}) {
  const maxVal = Math.max(...chart.data.map((d) => d.value), 1);
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
      <div className="flex flex-1 items-end justify-around gap-2">
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
                marginBottom: "4px",
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
                minHeight: "4px",
              }}
            />
            <span
              style={{
                fontSize: `${theme.fontSize.caption * scale}px`,
                color: theme.colors.textMuted,
                marginTop: "4px",
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
