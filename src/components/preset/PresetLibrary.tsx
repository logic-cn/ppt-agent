import type { DeckPreset } from "@/types/preset";
import { getPresets } from "@/presets";

export function PresetLibrary({ onPick }: { onPick: (p: DeckPreset) => void }) {
  const presets = getPresets();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          className="rounded-xl border border-border bg-white p-3 text-left transition hover:border-accent"
        >
          <div className="text-sm font-medium">{p.name}</div>
          {p.description && (
            <div className="mt-1 line-clamp-2 text-[11px] text-text-muted">
              {p.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
