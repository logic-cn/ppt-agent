import type { Slide, ChartType, ChartDataPoint } from "@/types/deck";

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "柱状图" },
  { value: "pie", label: "饼图" },
  { value: "line", label: "折线图" },
  { value: "doughnut", label: "环形图" },
];

interface Props {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
}

export function ChartTab({ slide, onUpdate }: Props) {
  const chart = slide.chart;

  const updateChart = (patch: Partial<NonNullable<typeof chart>>) => {
    onUpdate({
      chart: { ...chart!, ...patch },
    });
  };

  const addRow = () => {
    const data = [...(chart?.data ?? []), { label: "", value: 0 }];
    onUpdate({ chart: { ...chart!, type: chart?.type ?? "bar", data } });
  };

  const removeRow = (index: number) => {
    const data = chart?.data.filter((_, i) => i !== index) ?? [];
    if (data.length === 0) {
      onUpdate({ chart: undefined });
    } else {
      updateChart({ data });
    }
  };

  const updateRow = (index: number, patch: Partial<ChartDataPoint>) => {
    const data =
      chart?.data.map((row, i) => (i === index ? { ...row, ...patch } : row)) ??
      [];
    updateChart({ data });
  };

  if (!chart) {
    return (
      <div className="p-3 text-center text-sm text-text-muted">
        当前页面没有图表。
        <button
          onClick={() =>
            onUpdate({
              chart: { type: "bar", data: [{ label: "分类", value: 100 }] },
            })
          }
          className="mt-2 rounded-lg bg-gradient-to-r from-accent to-purple-500 px-3 py-1.5 text-xs text-white hover:opacity-90"
        >
          添加图表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs text-text-muted">图表类型</label>
        <select
          value={chart.type}
          onChange={(e) => updateChart({ type: e.target.value as ChartType })}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          {CHART_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">图表标题</label>
        <input
          value={chart.title ?? ""}
          onChange={(e) => updateChart({ title: e.target.value || undefined })}
          placeholder="可选"
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-text-muted">数据</label>
          <button
            onClick={addRow}
            className="text-xs text-accent hover:text-accent-hover"
          >
            + 新增行
          </button>
        </div>
        <div className="space-y-1">
          {chart.data.map((row, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder="标签"
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
              <button
                onClick={() => removeRow(i)}
                className="rounded p-1 text-text-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {chart.data.length > 0 && (
        <button
          onClick={() => onUpdate({ chart: undefined })}
          className="w-full rounded-lg border border-danger/20 px-3 py-1.5 text-xs text-danger hover:bg-danger/5"
        >
          删除图表
        </button>
      )}
    </div>
  );
}
