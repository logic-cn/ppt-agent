import { useEffect, useRef } from "react";
import type { Slide, ChartType, ChartDataPoint, ChartSpec } from "@/types/deck";
import type { SpecLock } from "@/design/spec-lock";
import {
  removeChartFromSvg,
  svgHasChartGroup,
  syncChartInSvg,
} from "@/engine/svg/sync-chart";
import { useT } from "@/hooks/use-page-t";
import type { TranslationKey } from "@/services/i18n";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { X } from "lucide-react";

const CHART_TYPES: { value: ChartType; label: TranslationKey }[] = [
  { value: "bar", label: "inspector.chartBar" },
  { value: "pie", label: "inspector.chartPie" },
  { value: "line", label: "inspector.chartLine" },
  { value: "doughnut", label: "inspector.chartDoughnut" },
];

interface Props {
  slide: Slide;
  specLock: SpecLock;
  onUpdate: (patch: Partial<Slide>) => void;
}

export function ChartTab({ slide, specLock, onUpdate }: Props) {
  const t = useT();
  const chart = slide.chart;
  const commitTimer = useRef<ReturnType<typeof setTimeout>>();
  // 记录尚未落盘的草稿：结构类修改（切类型/增删行）必须基于草稿合并，
  // 否则 300ms 后晚到的旧快照会把用户刚选的类型/新增行覆盖回去
  const pendingChart = useRef<ChartSpec | null>(null);

  // 切换页面时丢弃未落库的输入，避免写进上一页
  useEffect(
    () => () => {
      clearTimeout(commitTimer.current);
      pendingChart.current = null;
    },
    [slide.id],
  );

  const applyChart = (next: ChartSpec | undefined) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    pendingChart.current = null;
    if (!slide.svg) {
      onUpdate({ chart: next });
      return;
    }
    if (next) {
      const result = syncChartInSvg(slide.svg, next, specLock);
      onUpdate({
        chart: next,
        ...(result.synced
          ? { svg: result.svg, svgStale: slide.svgStale }
          : { svgStale: true }),
      });
      return;
    }
    const result = removeChartFromSvg(slide.svg);
    onUpdate({
      chart: undefined,
      svgStale: slide.svgStale,
      ...(result.removed ? { svg: result.svg } : {}),
    });
  };

  /** 当前最新值：优先使用等待落盘的草稿，保证结构修改不丢失文本输入 */
  const currentChart = () => pendingChart.current ?? chart;

  const updateChart = (patch: Partial<ChartSpec>) => {
    applyChart({ ...currentChart()!, ...patch });
  };

  /** 连续输入合并为一次历史（§9.5），与 slide-tab 的防抖约定一致 */
  const scheduleChart = (next: ChartSpec) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    pendingChart.current = next;
    commitTimer.current = setTimeout(() => {
      const latest = pendingChart.current;
      if (latest) applyChart(latest);
    }, 300);
  };

  const updateChartText = (patch: Partial<ChartSpec>) => {
    scheduleChart({ ...currentChart()!, ...patch });
  };

  const addRow = () => {
    const base = currentChart();
    const data = [...(base?.data ?? []), { label: "", value: 0 }];
    applyChart({ ...base!, type: base?.type ?? "bar", data });
  };

  const removeRow = (index: number) => {
    const data = currentChart()?.data.filter((_, i) => i !== index) ?? [];
    if (data.length === 0) {
      applyChart(undefined);
    } else {
      updateChart({ data });
    }
  };

  const updateRow = (index: number, patch: Partial<ChartDataPoint>) => {
    const data =
      currentChart()?.data.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ) ?? [];
    scheduleChart({ ...currentChart()!, data });
  };

  if (!chart) {
    return (
      <div className="p-3 text-center text-sm text-text-muted">
        {t("inspector.chartEmpty")}
        <Button
          size="xs"
          variant="primary"
          onClick={() =>
            applyChart({
              type: "bar",
              data: [{ label: t("inspector.chartSeedLabel"), value: 100 }],
            })
          }
          className="mt-2 bg-gradient-to-r from-accent to-accent-hover hover:opacity-90"
        >
          {t("inspector.chartAdd")}
        </Button>
      </div>
    );
  }

  const needsRedraw = !!slide.svg && !svgHasChartGroup(slide.svg);

  return (
    <div className="space-y-3 text-sm">
      {needsRedraw && (
        <p className="rounded-md bg-bg-surface px-2.5 py-2 text-xs text-text-muted">
          {t("inspector.chartNeedsRedraw")}
        </p>
      )}
      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.chartType")}
        </label>
        <select
          value={chart.type}
          onChange={(e) => updateChart({ type: e.target.value as ChartType })}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          {CHART_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.chartTitle")}
        </label>
        <input
          value={chart.title ?? ""}
          onChange={(e) =>
            updateChartText({ title: e.target.value || undefined })
          }
          placeholder={t("inspector.optional")}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-text-muted">
            {t("inspector.chartData")}
          </label>
          <button
            onClick={addRow}
            className="text-xs text-accent hover:text-accent-hover"
          >
            {t("inspector.chartAddRow")}
          </button>
        </div>
        <div className="space-y-1">
          {chart.data.map((row, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder={t("inspector.chartLabel")}
                className="flex-1 rounded border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
              <input
                type="number"
                value={row.value}
                onChange={(e) =>
                  updateRow(i, { value: parseFloat(e.target.value) || 0 })
                }
                className="w-20 rounded border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
              <IconButton
                label={t("inspector.removeChartRow")}
                onClick={() => removeRow(i)}
                variant="danger"
                icon={<X className="h-3.5 w-3.5" />}
                className="rounded p-1"
              />
            </div>
          ))}
        </div>
      </div>

      {chart.data.length > 0 && (
        <Button
          size="xs"
          variant="danger-outline"
          onClick={() => applyChart(undefined)}
          className="w-full"
        >
          {t("inspector.chartDelete")}
        </Button>
      )}
    </div>
  );
}
