import type { DeckPreset } from "@/types/preset";
import { getPresets } from "@/presets";
import { getPalette } from "@/design/palettes";
import type { VisualStyleId } from "@/types/design";

const VISUAL_STYLE_LABELS: Record<VisualStyleId, string> = {
  "swiss-minimal": "瑞士极简",
  "dark-tech": "暗色科技",
  "soft-rounded": "柔和圆角",
  editorial: "编辑排版",
  blueprint: "蓝图纸感",
  glassmorphism: "玻璃拟态",
};

export function PresetLibrary({ onPick }: { onPick: (p: DeckPreset) => void }) {
  const presets = getPresets();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {presets.map((p) => {
        const palette = getPalette(p.design.palette);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="flex flex-col rounded-xl border border-border bg-bg-elevated p-3 text-left transition hover:border-accent"
          >
            <div className="text-sm font-medium">{p.name}</div>
            {p.description && (
              <div className="mt-1 line-clamp-2 text-[11px] text-text-muted">
                {p.description}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                {VISUAL_STYLE_LABELS[p.design.visualStyle] ??
                  p.design.visualStyle}
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
