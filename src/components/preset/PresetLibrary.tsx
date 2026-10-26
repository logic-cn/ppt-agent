import type { DeckPreset } from "@/types/preset";
import { getPresets, SCENARIO_LABEL_KEY } from "@/presets";
import { getPresetDisplay } from "@/presets/display";
import { getPalette } from "@/design/palettes";
import { useSettingsStore } from "@/store/settings";
import { useT } from "@/hooks/use-page-t";

export function PresetLibrary({ onPick }: { onPick: (p: DeckPreset) => void }) {
  const t = useT();
  const lang = useSettingsStore((s) => s.settings.lang);
  const presets = getPresets();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {presets.map((p) => {
        const palette = getPalette(p.design.palette);
        const display = getPresetDisplay(p, lang);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="flex flex-col rounded-xl border border-border bg-bg-elevated p-3 text-left transition hover:border-accent"
          >
            <div className="text-sm font-medium">{display.name}</div>
            {display.description && (
              <div className="mt-1 line-clamp-2 text-[11px] text-text-muted">
                {display.description}
              </div>
            )}
            {/* 模板选择页展示场景 / 页数 / 适用对象（路线图 §12.5） */}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {p.scenario && (
                <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {t(SCENARIO_LABEL_KEY[p.scenario])}
                </span>
              )}
              <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                {t("preset.pageCount", { count: p.slides.length })}
              </span>
              {display.audience && (
                <span
                  className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted"
                  title={t("preset.audienceHint", {
                    audience: display.audience,
                  })}
                >
                  {t("preset.audience", { audience: display.audience })}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                {t(`style.${p.design.visualStyle}`)}
              </span>
              {palette && (
                <span className="flex gap-1">
                  {[
                    palette.colors.primary,
                    palette.colors.accent,
                    palette.colors.background,
                  ].map((c, i) => (
                    <span
                      key={i}
                      className="h-3 w-3 rounded-full border border-border"
                      style={{ background: c }}
                    />
                  ))}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
