import type { DesignLock } from "@/types/design";
import { NARRATIVE_MODE_IDS, VISUAL_STYLE_IDS } from "@/types/design";
import { PalettePicker } from "./PalettePicker";
import { useT } from "@/hooks/use-page-t";

interface Props {
  design: DesignLock;
  onChange: (next: DesignLock) => void;
}

export function DesignPanel({ design, onChange }: Props) {
  const t = useT();
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted">
          {t("design.mode")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {NARRATIVE_MODE_IDS.map((id) => {
            const selected = id === design.mode;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...design, mode: id })}
                aria-pressed={selected}
                className={[
                  "rounded-md px-2.5 py-1.5 text-sm transition",
                  selected
                    ? "bg-accent text-white"
                    : "bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                ].join(" ")}
              >
                {t(`mode.${id}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted">
          {t("design.visualStyle")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {VISUAL_STYLE_IDS.map((id) => {
            const selected = id === design.visualStyle;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...design, visualStyle: id })}
                aria-pressed={selected}
                className={[
                  "rounded-full border px-2.5 py-1.5 text-sm transition",
                  selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-accent hover:bg-bg-hover",
                ].join(" ")}
              >
                {t(`style.${id}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted">
          {t("design.palette")}
        </h3>
        <PalettePicker
          value={design.palette}
          onChange={(id) => onChange({ ...design, palette: id })}
        />
      </section>
    </div>
  );
}
