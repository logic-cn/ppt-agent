import type { NarrativeModeId } from "@/types/design";
import { NARRATIVE_MODE_IDS } from "@/types/design";
import { NARRATIVE_MODES } from "@/design/narrative-modes";
import { useT } from "@/hooks/use-page-t";

interface Props {
  value: NarrativeModeId;
  onChange: (id: NarrativeModeId) => void;
}

export function ModePicker({ value, onChange }: Props) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {NARRATIVE_MODE_IDS.map((id) => {
        const mode = NARRATIVE_MODES[id];
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={selected}
            className={[
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
              selected
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-surface hover:border-accent hover:bg-bg-hover",
            ].join(" ")}
          >
            <span className="text-sm font-medium text-text-primary">
              {t(`mode.${id}`)}
            </span>
            <span className="line-clamp-2 text-[11px] text-text-muted">
              {t(`mode.${mode.id}.bestFor`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
