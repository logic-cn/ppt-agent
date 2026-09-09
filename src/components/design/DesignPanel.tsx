import type { DesignLock } from "@/types/design";
import { NARRATIVE_MODE_IDS, VISUAL_STYLE_IDS } from "@/types/design";
import { CANVAS_FORMATS } from "@/types/canvas";
import type { TransitionStyle } from "@/types/deck";
import { PalettePicker } from "./PalettePicker";
import { useT } from "@/hooks/use-page-t";

const TRANSITIONS: TransitionStyle[] = ["none", "fade", "push", "wipe", "cut"];

interface Props {
  design: DesignLock;
  onChange: (next: DesignLock) => void;
  /** 放映偏好（存于 deck，不属设计契约；D1） */
  transition?: TransitionStyle;
  entranceAnimation?: boolean;
  onTransitionChange?: (t: TransitionStyle) => void;
  onEntranceAnimationChange?: (v: boolean) => void;
}

export function DesignPanel({
  design,
  onChange,
  transition,
  entranceAnimation,
  onTransitionChange,
  onEntranceAnimationChange,
}: Props) {
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
          {t("design.canvas")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {CANVAS_FORMATS.map((f) => {
            const selected = (design.canvasFormat ?? "ppt-16-9") === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ ...design, canvasFormat: f.id })}
                aria-pressed={selected}
                className={[
                  "rounded-md border px-2.5 py-1.5 text-sm transition",
                  selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-accent hover:bg-bg-hover",
                ].join(" ")}
              >
                {t(`canvas.${f.id}`)}
                <span className="ml-1 text-xs text-text-muted">
                  {f.w}×{f.h}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted">
          {t("design.playback")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {TRANSITIONS.map((tr) => {
            const selected = (transition ?? "none") === tr;
            return (
              <button
                key={tr}
                type="button"
                onClick={() => onTransitionChange?.(tr)}
                aria-pressed={selected}
                className={[
                  "rounded-md border px-2.5 py-1.5 text-sm transition",
                  selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-accent hover:bg-bg-hover",
                ].join(" ")}
              >
                {t(`transition.${tr}`)}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-col gap-1.5 text-sm text-text-secondary">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={entranceAnimation ?? false}
              onChange={(e) => onEntranceAnimationChange?.(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            {t("design.entranceAnimation")}
          </label>
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
