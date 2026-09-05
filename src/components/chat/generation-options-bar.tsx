import { SlidersHorizontal } from "lucide-react";
import type { GenerationOptions } from "@/types/generation";
import { useT } from "@/hooks/use-page-t";

/**
 * 生成前参数控制栏（路线图 §7.3）：
 * 可折叠面板，约束 AI 生成大纲的场景/语气/密度/受众/图表倾向/页数。
 * 仅负责收集参数，输出语言由调用方按界面语言注入。
 */

interface Props {
  open: boolean;
  onToggle: () => void;
  options: GenerationOptions;
  onChange: (next: GenerationOptions) => void;
}

/** 控件统一外观（深浅色均走语义 token） */
const CONTROL_CLS =
  "w-full rounded-md border border-border bg-bg-surface px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";
const LABEL_CLS = "flex flex-col gap-1 text-[11px] text-text-muted";

export function GenerationOptionsBar({
  open,
  onToggle,
  options,
  onChange,
}: Props) {
  const t = useT();

  const set = <K extends keyof GenerationOptions>(
    key: K,
    value: GenerationOptions[K] | undefined,
  ) => {
    const next = { ...options };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  const activeCount = Object.values(options).filter(
    (v) => v !== undefined,
  ).length;

  return (
    <div className="px-3 pb-1">
      <button
        onClick={onToggle}
        aria-expanded={open}
        title={t("chat.genOptions")}
        className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {open ? t("chat.genOptionsHide") : t("chat.genOptionsShow")}
        {activeCount > 0 && (
          <span className="rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-medium text-accent">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg-elevated p-2.5">
          <label className={LABEL_CLS}>
            <span>{t("chat.genOptionsScenario")}</span>
            <select
              value={options.scenario ?? ""}
              onChange={(e) =>
                set(
                  "scenario",
                  (e.target.value ||
                    undefined) as GenerationOptions["scenario"],
                )
              }
              className={CONTROL_CLS}
            >
              <option value="">{t("chat.genOptionsAuto")}</option>
              <option value="business_review">
                {t("scenario.businessReview")}
              </option>
              <option value="pitch">{t("scenario.pitch")}</option>
              <option value="training">{t("scenario.training")}</option>
              <option value="market_analysis">
                {t("scenario.marketAnalysis")}
              </option>
              <option value="proposal">{t("scenario.proposal")}</option>
            </select>
          </label>

          <label className={LABEL_CLS}>
            <span>{t("chat.genOptionsTone")}</span>
            <select
              value={options.tone ?? ""}
              onChange={(e) =>
                set(
                  "tone",
                  (e.target.value || undefined) as GenerationOptions["tone"],
                )
              }
              className={CONTROL_CLS}
            >
              <option value="">{t("chat.genOptionsAuto")}</option>
              <option value="formal">{t("tone.formal")}</option>
              <option value="consulting">{t("tone.consulting")}</option>
              <option value="concise">{t("tone.concise")}</option>
              <option value="storytelling">{t("tone.storytelling")}</option>
            </select>
          </label>

          <label className={LABEL_CLS}>
            <span>{t("chat.genOptionsDensity")}</span>
            <select
              value={options.density ?? ""}
              onChange={(e) =>
                set(
                  "density",
                  (e.target.value || undefined) as GenerationOptions["density"],
                )
              }
              className={CONTROL_CLS}
            >
              <option value="">{t("chat.genOptionsAuto")}</option>
              <option value="low">{t("density.low")}</option>
              <option value="medium">{t("density.medium")}</option>
              <option value="high">{t("density.high")}</option>
            </select>
          </label>

          <label className={LABEL_CLS}>
            <span>{t("chat.genOptionsCharts")}</span>
            <select
              value={
                options.includeCharts === undefined
                  ? ""
                  : options.includeCharts
                    ? "true"
                    : "false"
              }
              onChange={(e) =>
                set(
                  "includeCharts",
                  e.target.value === "" ? undefined : e.target.value === "true",
                )
              }
              className={CONTROL_CLS}
            >
              <option value="">{t("chat.genOptionsAuto")}</option>
              <option value="true">{t("charts.encourage")}</option>
              <option value="false">{t("charts.avoid")}</option>
            </select>
          </label>

          <label className={LABEL_CLS}>
            <span>{t("chat.genOptionsPageCount")}</span>
            <input
              type="number"
              min={2}
              max={50}
              value={options.pageCount ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  set("pageCount", undefined);
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                set("pageCount", Math.max(2, Math.min(50, Math.round(n))));
              }}
              placeholder={t("chat.genOptionsPageCountPlaceholder")}
              className={CONTROL_CLS}
            />
          </label>

          <label className={`${LABEL_CLS} col-span-2`}>
            <span>{t("chat.genOptionsAudience")}</span>
            <input
              type="text"
              value={options.audience ?? ""}
              onChange={(e) => set("audience", e.target.value || undefined)}
              placeholder={t("chat.genOptionsAudiencePlaceholder")}
              className={CONTROL_CLS}
            />
          </label>
        </div>
      )}
    </div>
  );
}
