import type { Slide, ChartSpec } from "@/types/deck";
import type { Theme, Rect } from "@/types/theme";
import { rectToStyle } from "./utils";
import { BulletList } from "./bullet-list";

interface Props {
  slide: Slide;
  theme: Theme;
  /** 实际渲染宽度（px），用于字号缩放基准 */
  width: number;
}

/** 判断是否为多列布局 */
function isColsLayout(layout: string): boolean {
  return layout.startsWith("cols-");
}

/** 获取列数，如 "cols-3" → 3 */
function getColCount(layout: string): number {
  const m = layout.match(/cols-(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

/** 将 body 区域等分为 N 列，列间保留 gap */
function getColumnRects(body: Rect, numCols: number): Rect[] {
  const gap = 0.025;
  const colW = (body.w - gap * (numCols - 1)) / numCols;
  const rects: Rect[] = [];
  for (let i = 0; i < numCols; i++) {
    rects.push({
      x: body.x + i * (colW + gap),
      y: body.y,
      w: colW,
      h: body.h,
    });
  }
  return rects;
}

export function SlideRenderer({ slide, theme, width }: Props) {
  const layout = theme.layouts[slide.layout];
  const scale = width / 1280;
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
              background: `linear-gradient(to bottom, ${theme.colors.primary}, ${theme.colors.secondary})`,
              borderRadius: `0 ${3 * scale}px ${3 * scale}px 0`,
              opacity: 0.2,
            }}
          />
        )}

      {renderTitle()}

      {isCols ? renderColumns() : renderBody()}

      {(slide.layout === "two-column" ||
        slide.layout === "chart" ||
        slide.layout === "image") &&
        renderVisual()}

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
    </div>
  );
}
