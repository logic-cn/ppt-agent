import type { VisualStyleId } from "@/types/design";
import { VISUAL_STYLES } from "@/design/visual-styles";
import { useT } from "@/hooks/use-page-t";

interface Props {
  value: VisualStyleId;
  onChange: (id: VisualStyleId) => void;
}

export function StylePicker({ value, onChange }: Props) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {VISUAL_STYLES.map((style) => {
        const selected = style.id === value;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            aria-pressed={selected}
            className={[
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
              selected
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-surface hover:border-accent hover:bg-bg-hover",
            ].join(" ")}
          >
            <span className="text-sm font-medium text-text-primary">
              {t(`style.${style.id}`)}
            </span>
            <span className="line-clamp-3 text-[11px] leading-relaxed text-text-muted">
              {t(`style.${style.id}.character`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
