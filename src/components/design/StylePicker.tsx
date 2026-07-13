import type { VisualStyleId } from "@/types/design";
import { VISUAL_STYLES } from "@/design/visual-styles";

interface Props {
  value: VisualStyleId;
  onChange: (id: VisualStyleId) => void;
}

export function StylePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {VISUAL_STYLES.map((style) => {
        const selected = style.id === value;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id as VisualStyleId)}
            aria-pressed={selected}
            className={[
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
              selected
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-surface hover:border-accent hover:bg-bg-hover",
            ].join(" ")}
          >
            <span className="text-sm font-medium text-text-primary">
              {style.name}
            </span>
            <span className="line-clamp-3 text-[11px] leading-relaxed text-text-muted">
              {style.character}
            </span>
          </button>
        );
      })}
    </div>
  );
}
