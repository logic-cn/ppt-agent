import type { PaletteId } from "@/types/design";
import { PALETTES } from "@/design/palettes";

interface Props {
  value: PaletteId;
  onChange: (id: PaletteId) => void;
}

export function PalettePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PALETTES.map((palette) => {
        const selected = palette.id === value;
        return (
          <button
            key={palette.id}
            type="button"
            onClick={() => onChange(palette.id)}
            aria-pressed={selected}
            className={[
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition",
              selected
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-surface hover:border-accent hover:bg-bg-hover",
            ].join(" ")}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: palette.colors.primary }}
              />
              <span
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: palette.colors.accent }}
              />
            </span>
            <span className="text-sm font-medium text-text-primary">
              {palette.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
